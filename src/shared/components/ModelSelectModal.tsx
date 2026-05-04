"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MagnifyingGlassIcon as Search,
  StackIcon as Layers,
  CheckIcon as Check,
  PencilIcon as Edit2,
  MagnifyingGlassIcon as SearchX,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getModelsByProviderId, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS, FREE_PROVIDERS, FREE_TIER_PROVIDERS, isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { getProviderFetchKey, loadLiveProviderModels, type LiveProviderModelMap, type ProviderModelsResponse } from "@/shared/utils/providerModelLiveFetch";

const PROVIDER_ORDER = [
  ...Object.keys(OAUTH_PROVIDERS),
  ...Object.keys(FREE_PROVIDERS),
  ...Object.keys(FREE_TIER_PROVIDERS),
  ...Object.keys(APIKEY_PROVIDERS),
];

const NO_AUTH_PROVIDER_IDS = Object.keys(FREE_PROVIDERS).filter(id => (FREE_PROVIDERS as any)[id].noAuth);

interface Combo {
  id: string;
  name: string;
}

interface ProviderNode {
  id: string;
  name: string;
  prefix: string;
}

interface ProviderConnection {
  id: string;
  provider: string;
  name?: string;
  providerSpecificData?: {
    prefix?: string;
  };
}

interface ModelItem {
  id: string;
  name: string;
  value: string;
  isPlaceholder?: boolean;
  isCustom?: boolean;
}

interface GroupedModels {
  [providerId: string]: {
    name: string;
    alias: string;
    color: string;
    models: ModelItem[];
  };
}

const getProviderAliasModels = (modelAliases: Record<string, string>, alias: string): ModelItem[] => Object.entries(modelAliases)
  .filter(([, value]) => value.startsWith(`${alias}/`))
  .map(([name, value]) => ({
    id: value.replace(`${alias}/`, ""),
    name,
    value,
    isCustom: true,
  }));

const mapProviderModels = (models: ProviderModelsResponse["models"], alias: string): ModelItem[] => models.map((model) => ({
  id: model.id,
  name: model.name || model.id,
  value: `${alias}/${model.id}`,
}));

const mergeProviderModels = (primary: ModelItem[], extra: ModelItem[]): ModelItem[] => {
  const seen = new Set(primary.map((model) => model.id));
  return [...primary, ...extra.filter((model) => !seen.has(model.id))];
};

const getStaticProviderModels = (providerId: string, alias: string, modelAliases: Record<string, string>): ModelItem[] => {
  const hard = getModelsByProviderId(providerId);
  const hardIds = new Set(hard.map((model) => model.id));
  const hasHard = hard.length > 0;
  const custom = getProviderAliasModels(modelAliases, alias).filter((model) => (hasHard ? model.name === model.id : true) && !hardIds.has(model.id));
  return mergeProviderModels(hard.map((model) => ({ id: model.id, name: model.name || model.id, value: `${alias}/${model.id}` })), custom);
};

const getLiveProviderModels = (providerId: string, alias: string, liveProviderModels: LiveProviderModelMap, modelAliases: Record<string, string>): ModelItem[] | null => {
  const live = liveProviderModels[providerId];
  if (!live || live.length === 0) return null;
  return mergeProviderModels(mapProviderModels(live, alias), getProviderAliasModels(modelAliases, alias));
};

const buildGroupedModels = (
  activeProviders: ProviderConnection[],
  modelAliases: Record<string, string>,
  allProviders: Record<string, any>,
  providerNodes: ProviderNode[],
  liveProviderModels: LiveProviderModelMap,
): GroupedModels => {
  const groups: GroupedModels = {};
  const activeConnectionIds = activeProviders.map((provider) => provider.provider);
  const providerIdsToShow = new Set([...activeConnectionIds, ...NO_AUTH_PROVIDER_IDS]);
  const sortedProviderIds = [...providerIdsToShow].sort((a, b) => {
    const indexA = PROVIDER_ORDER.indexOf(a);
    const indexB = PROVIDER_ORDER.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  sortedProviderIds.forEach((providerId) => {
    const alias = (PROVIDER_ID_TO_ALIAS as any)[providerId] || providerId;
    const providerInfo = (allProviders as any)[providerId] || { name: providerId, color: "#666" };
    const isCustomProvider = isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);

    if (providerInfo.passthroughModels) {
      const aliasModels = getProviderAliasModels(modelAliases, alias);
      if (aliasModels.length > 0) {
        groups[providerId] = {
          name: providerNodes.find((node) => node.id === providerId)?.name || providerInfo.name,
          alias,
          color: providerInfo.color,
          models: aliasModels,
        };
      }
      return;
    }

    if (isCustomProvider) {
      const connection = activeProviders.find((provider) => provider.provider === providerId);
      const node = providerNodes.find((provider) => provider.id === providerId);
      const prefix = connection?.providerSpecificData?.prefix || node?.prefix || alias;
      groups[providerId] = {
        name: node?.name || providerInfo.name,
        alias,
        color: providerInfo.color,
        models: [{ id: `__p__${providerId}`, name: `${prefix}/model-id`, value: `${prefix}/model-id`, isPlaceholder: true }],
      };
      return;
    }

    const liveModels = getLiveProviderModels(providerId, alias, liveProviderModels, modelAliases);
    const models = liveModels || getStaticProviderModels(providerId, alias, modelAliases);
    if (models.length > 0) {
      groups[providerId] = { name: providerInfo.name, alias, color: providerInfo.color, models };
    }
  });

  return groups;
};

interface ModelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (model: ModelItem) => void;
  selectedModel?: string | null;
  activeProviders?: ProviderConnection[];
  title?: string;
  modelAliases?: Record<string, string>;
}

export default function ModelSelectModal({ isOpen, onClose, onSelect, selectedModel, activeProviders = [], title = "Select Model", modelAliases = {} }: ModelSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [combos, setCombos] = useState<Combo[]>([]);
  const [providerNodes, setProviderNodes] = useState<ProviderNode[]>([]);
  const [liveProviderModels, setLiveProviderModels] = useState<LiveProviderModelMap>({});
  const lastFetchedProviderKeyRef = useRef<string | null>(null);
  const providerFetchKey = useMemo(() => getProviderFetchKey(activeProviders), [activeProviders]);

  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/combos")
      .then((response) => response.json())
      .then((data) => setCombos(data.combos || []))
      .catch(() => {});

    fetch("/api/provider-nodes")
      .then((response) => response.json())
      .then((data) => setProviderNodes(data.nodes || []))
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || providerFetchKey.length === 0 || providerFetchKey === lastFetchedProviderKeyRef.current) {
      return;
    }

    let cancelled = false;
    loadLiveProviderModels(activeProviders)
      .then((models) => {
        if (!cancelled) {
          lastFetchedProviderKeyRef.current = providerFetchKey;
          setLiveProviderModels(models);
        }
      })
      .catch(() => {
        if (!cancelled) {
          lastFetchedProviderKeyRef.current = providerFetchKey;
          setLiveProviderModels({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProviders, isOpen, providerFetchKey]);

  const allProviders = useMemo(() => ({ ...OAUTH_PROVIDERS, ...FREE_PROVIDERS, ...FREE_TIER_PROVIDERS, ...APIKEY_PROVIDERS }), []);

  const groupedModels = useMemo(
    () => buildGroupedModels(activeProviders, modelAliases, allProviders, providerNodes, liveProviderModels),
    [activeProviders, modelAliases, allProviders, providerNodes, liveProviderModels],
  );

  const filteredCombos = useMemo(() => combos.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())), [combos, searchQuery]);
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const f: GroupedModels = {};
    Object.entries(groupedModels).forEach(([pid, g]) => {
      const models = g.models.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
      if (models.length || g.name.toLowerCase().includes(q)) f[pid] = { ...g, models };
    });
    return f;
  }, [groupedModels, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-border/50 shadow-none">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          <div className="relative mt-4">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
             <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search infrastructure models..." className="pl-9 h-10 bg-muted/10 border-border/40 focus-visible:bg-background transition-all shadow-none" />
          </div>
        </DialogHeader>

        <ScrollArea className="h-[450px] px-6 pb-6">
          <div className="space-y-6 pt-2">
            {filteredCombos.length > 0 && (
              <div className="space-y-3">
                 <div className="flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                    <Layers className="size-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">System Combos</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {filteredCombos.map(c => (
                      <button key={c.id} onClick={() => onSelect({ id: c.id, name: c.name, value: c.id })} className={cn("px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-none", selectedModel === c.name ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 border-border/40 hover:border-primary/30")}>
                         <Layers className="size-3.5 inline mr-1.5 opacity-70" />{c.name}
                      </button>
                    ))}
                 </div>
              </div>
            )}

            {Object.entries(filteredGroups).map(([pid, g]) => (
              <div key={pid} className="space-y-3">
                 <div className="flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">{g.name}</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {g.models.map(m => (
                      <button key={m.value} onClick={() => !m.isPlaceholder && onSelect(m)} className={cn("px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-none flex items-center gap-1.5", m.isPlaceholder ? "border-dashed opacity-60 hover:opacity-100" : selectedModel === m.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/50 hover:border-primary/30")}>
                         {m.isPlaceholder ? <Edit2 className="size-3.5" /> : selectedModel === m.value ? <Check className="size-3.5" /> : <Badge variant="outline" className="px-1.5 py-0 h-5 text-[9px] uppercase tracking-wider border-border/50">{g.alias}</Badge>}
                         <span>{m.name}</span>
                      </button>
                    ))}
                 </div>
              </div>
            ))}

            {Object.keys(filteredGroups).length === 0 && filteredCombos.length === 0 && (
              <div className="py-20 text-center opacity-30 flex flex-col items-center gap-2">
                 <SearchX className="size-10" />
                 <p className="text-[10px] font-bold uppercase tracking-widest">No models match your search</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
