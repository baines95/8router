"use client";

import { useState, useEffect, useCallback } from"react";
import { useParams, useRouter } from"next/navigation";
import Link from"next/link";
import Image from"next/image";
import {
  Cookie,
  CircleNotch,
  PencilSimple as Pencil,
  Plus,
  Trash,
  ArrowLeft,
  Warning,
  Info,
  Lock,
  LockOpen,
  Key,
  ShieldCheck
} from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { translate } from "@/i18n/runtime";
import { cn } from"@/lib/utils";
import { Button, buttonVariants } from"@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Skeleton } from"@/components/ui/skeleton";
import { Switch } from"@/components/ui/switch";
import {
 OAuthModal,
 KiroOAuthWrapper,
 CursorAuthModal,
 IFlowCookieModal,
 GitLabAuthModal,
 EditConnectionModal,
} from"@/shared/components";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS, FREE_PROVIDERS, FREE_TIER_PROVIDERS, getProviderAlias, isOpenAICompatibleProvider, isAnthropicCompatibleProvider, AI_PROVIDERS, THINKING_CONFIG } from"@/shared/constants/providers";
import { getModelsByProviderId } from"@/shared/constants/models";
import { useCopyToClipboard } from"@/shared/hooks/useCopyToClipboard";
import { fetchSuggestedModels } from"@/shared/utils/providerModelsFetcher";
import ModelRow from"./ModelRow";
import PassthroughModelsSection from"./PassthroughModelsSection";
import CompatibleModelsSection from"./CompatibleModelsSection";
import ConnectionRow from"./ConnectionRow";
import AddApiKeyModal from"./AddApiKeyModal";
import EditCompatibleNodeModal from"./EditCompatibleNodeModal";
import AddCustomModelModal from"./AddCustomModelModal";

export default function ProviderDetailPage() {
 const params = useParams();
 const router = useRouter();
 const providerId = params.id;
 const [connections, setConnections] = useState([]);
 const [loading, setLoading] = useState(true);
 const [providerNode, setProviderNode] = useState(null);
 const [proxyPools, setProxyPools] = useState([]);
 const [showOAuthModal, setShowOAuthModal] = useState(false);
 const [showIFlowCookieModal, setShowIFlowCookieModal] = useState(false);
 const [showAddApiKeyModal, setShowAddApiKeyModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showEditNodeModal, setShowEditNodeModal] = useState(false);
 const [showBulkProxyModal, setShowBulkProxyModal] = useState(false);
 const [selectedConnection, setSelectedConnection] = useState(null);
 const [modelAliases, setModelAliases] = useState({});
 const [headerImgError, setHeaderImgError] = useState(false);
 const [modelTestResults, setModelTestResults] = useState({});
 const [modelsTestError, setModelsTestError] = useState("");
 const [testingModelId, setTestingModelId] = useState(null);
 const [showAddCustomModel, setShowAddCustomModel] = useState(false);
 const [selectedConnectionIds, setSelectedConnectionIds] = useState([]);
 const [bulkProxyPoolId, setBulkProxyPoolId] = useState("__none__");
 const [bulkUpdatingProxy, setBulkUpdatingProxy] = useState(false);
 const [providerStrategy, setProviderStrategy] = useState(null); // null = use global,"round-robin"= override
 const [providerStickyLimit, setProviderStickyLimit] = useState("");
 const [thinkingMode, setThinkingMode] = useState("auto");
 const [suggestedModels, setSuggestedModels] = useState([]);
 const [kiloFreeModels, setKiloFreeModels] = useState([]);
 const { copied, copy } = useCopyToClipboard();

 const providerInfo = providerNode
 ? {
 id: providerNode.id,
 name: providerNode.name || (providerNode.type ==="anthropic-compatible"?"Anthropic Compatible":"OpenAI Compatible"),
 color: providerNode.type ==="anthropic-compatible"?"#D97757":"#10A37F",
 textIcon: providerNode.type ==="anthropic-compatible"?"AC":"OC",
 apiType: providerNode.apiType,
 baseUrl: providerNode.baseUrl,
 type: providerNode.type,
 }
 : (OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || FREE_TIER_PROVIDERS[providerId]);
 const isOAuth = !!OAUTH_PROVIDERS[providerId] || !!FREE_PROVIDERS[providerId];
 const isFreeNoAuth = !!FREE_PROVIDERS[providerId]?.noAuth;
 const models = getModelsByProviderId(providerId);
 const providerAlias = getProviderAlias(providerId);
 
 const isOpenAICompatible = isOpenAICompatibleProvider(providerId);
 const isAnthropicCompatible = isAnthropicCompatibleProvider(providerId);
 const isCompatible = isOpenAICompatible || isAnthropicCompatible;
 const thinkingConfig = AI_PROVIDERS[providerId]?.thinkingConfig || THINKING_CONFIG.extended;
 
 const providerStorageAlias = isCompatible ? providerId : providerAlias;
 const providerDisplayAlias = isCompatible
 ? (providerNode?.prefix || providerId)
 : providerAlias;

 // Define callbacks BEFORE the useEffect that uses them
 const fetchAliases = useCallback(async () => {
 try {
 const res = await fetch("/api/models/alias");
 const data = await res.json();
 if (res.ok) {
 setModelAliases(data.aliases || {});
 }
 } catch (error) {
 console.log("Error fetching aliases:", error);
 }
 }, []);

 // Fetch free models from Kilo API for kilocode provider
 useEffect(() => {
 if (providerId !=="kilocode") return;
 fetch("/api/providers/kilo/free-models")
 .then((res) => res.json())
 .then((data) => { if (data.models?.length) setKiloFreeModels(data.models); })
 .catch(() => {});
 }, [providerId]);

 const fetchConnections = useCallback(async () => {
 try {
 const [connectionsRes, nodesRes, proxyPoolsRes, settingsRes] = await Promise.all([
 fetch("/api/providers", { cache:"no-store"}),
 fetch("/api/provider-nodes", { cache:"no-store"}),
 fetch("/api/proxy-pools?isActive=true", { cache:"no-store"}),
 fetch("/api/settings", { cache:"no-store"}),
 ]);
 const connectionsData = await connectionsRes.json();
 const nodesData = await nodesRes.json();
 const proxyPoolsData = await proxyPoolsRes.json();
 const settingsData = settingsRes.ok ? await settingsRes.json() : {};
 if (connectionsRes.ok) {
 const filtered = (connectionsData.connections || []).filter(c => c.provider === providerId);
 setConnections(filtered);
 }
 if (proxyPoolsRes.ok) {
 setProxyPools(proxyPoolsData.proxyPools || []);
 }
 // Load per-provider strategy override
 const override = (settingsData.providerStrategies || {})[providerId] || {};
 setProviderStrategy(override.fallbackStrategy || null);
 setProviderStickyLimit(override.stickyRoundRobinLimit != null ? String(override.stickyRoundRobinLimit) :"1");
 // Load per-provider thinking config
 const thinkingCfg = (settingsData.providerThinking || {})[providerId] || {};
 setThinkingMode(thinkingCfg.mode ||"auto");
 if (nodesRes.ok) {
 let node = (nodesData.nodes || []).find((entry) => entry.id === providerId) || null;

 // Newly created compatible nodes can be briefly unavailable on one worker.
 // Retry a few times before showing"Provider not found".
 if (!node && isCompatible) {
 for (let attempt = 0; attempt < 3; attempt += 1) {
 await new Promise((resolve) => setTimeout(resolve, 150));
 const retryRes = await fetch("/api/provider-nodes", { cache:"no-store"});
 if (!retryRes.ok) continue;
 const retryData = await retryRes.json();
 node = (retryData.nodes || []).find((entry) => entry.id === providerId) || null;
 if (node) break;
 }
 }

 setProviderNode(node);
 }
 } catch (error) {
 console.log("Error fetching connections:", error);
 } finally {
 setLoading(false);
 }
 }, [providerId, isCompatible]);

 const handleUpdateNode = async (formData) => {
 try {
 const res = await fetch(`/api/provider-nodes/${providerId}`, {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify(formData),
 });
 const data = await res.json();
 if (res.ok) {
 setProviderNode(data.node);
 await fetchConnections();
 setShowEditNodeModal(false);
 }
 } catch (error) {
 console.log("Error updating provider node:", error);
 }
 };

 const saveProviderStrategy = async (strategy, stickyLimit) => {
 try {
 const settingsRes = await fetch("/api/settings", { cache:"no-store"});
 const settingsData = settingsRes.ok ? await settingsRes.json() : {};
 const current = settingsData.providerStrategies || {};

 // Build override: null strategy means remove override, use global
 const override = {};
 if (strategy) override.fallbackStrategy = strategy;
 if (strategy ==="round-robin"&& stickyLimit !=="") {
 override.stickyRoundRobinLimit = Number(stickyLimit) || 3;
 }

 const updated = { ...current };
 if (Object.keys(override).length === 0) {
 delete updated[providerId];
 } else {
 updated[providerId] = override;
 }

 await fetch("/api/settings", {
 method:"PATCH",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ providerStrategies: updated }),
 });
 } catch (error) {
 console.log("Error saving provider strategy:", error);
 }
 };

 const handleRoundRobinToggle = (enabled) => {
 const strategy = enabled ?"round-robin": null;
 const sticky = enabled ? (providerStickyLimit ||"1") : providerStickyLimit;
 if (enabled && !providerStickyLimit) setProviderStickyLimit("1");
 setProviderStrategy(strategy);
 saveProviderStrategy(strategy, sticky);
 };

 const handleStickyLimitChange = (value) => {
 setProviderStickyLimit(value);
 saveProviderStrategy("round-robin", value);
 };

 const saveThinkingConfig = async (mode) => {
 try {
 const settingsRes = await fetch("/api/settings", { cache:"no-store"});
 const settingsData = settingsRes.ok ? await settingsRes.json() : {};
 const current = settingsData.providerThinking || {};
 const updated = { ...current };
 if (!mode || mode ==="auto") {
 delete updated[providerId];
 } else {
 updated[providerId] = { mode };
 }
 await fetch("/api/settings", {
 method:"PATCH",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ providerThinking: updated }),
 });
 } catch (error) {
 console.log("Error saving thinking config:", error);
 }
 };

 const handleThinkingModeChange = (mode) => {
 setThinkingMode(mode);
 saveThinkingConfig(mode);
 };

 useEffect(() => {
 fetchConnections();
 fetchAliases();
 }, [fetchConnections, fetchAliases]);

 // Fetch suggested models from provider's public API (if configured)
 useEffect(() => {
 const fetcher = (OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || FREE_TIER_PROVIDERS[providerId])?.modelsFetcher;
 if (!fetcher) return;
 fetchSuggestedModels(fetcher).then(setSuggestedModels);
 }, [providerId]);

 const handleSetAlias = async (modelId, alias, providerAliasOverride = providerAlias) => {
 const fullModel = `${providerAliasOverride}/${modelId}`;
 try {
 const res = await fetch("/api/models/alias", {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ model: fullModel, alias }),
 });
 if (res.ok) {
 await fetchAliases();
 } else {
 const data = await res.json();
 alert(data.error ||"Failed to set alias");
 }
 } catch (error) {
 console.log("Error setting alias:", error);
 }
 };

 const handleDeleteAlias = async (alias) => {
 try {
 const res = await fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
 method:"DELETE",
 });
 if (res.ok) {
 await fetchAliases();
 }
 } catch (error) {
 console.log("Error deleting alias:", error);
 }
 };

 const handleDelete = async (id) => {
 if (!confirm("Delete this connection?")) return;
 try {
 const res = await fetch(`/api/providers/${id}`, { method:"DELETE"});
 if (res.ok) {
 setConnections(connections.filter(c => c.id !== id));
 }
 } catch (error) {
 console.log("Error deleting connection:", error);
 }
 };

 const handleOAuthSuccess = () => {
 fetchConnections();
 setShowOAuthModal(false);
 };

 const handleIFlowCookieSuccess = () => {
 fetchConnections();
 setShowIFlowCookieModal(false);
 };

 const handleSaveApiKey = async (formData) => {
 try {
 const res = await fetch("/api/providers", {
 method:"POST",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ provider: providerId, ...formData }),
 });
 if (res.ok) {
 await fetchConnections();
 setShowAddApiKeyModal(false);
 }
 } catch (error) {
 console.log("Error saving connection:", error);
 }
 };

 const handleUpdateConnection = async (formData) => {
 try {
 const res = await fetch(`/api/providers/${selectedConnection.id}`, {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify(formData),
 });
 if (res.ok) {
 await fetchConnections();
 setShowEditModal(false);
 }
 } catch (error) {
 console.log("Error updating connection:", error);
 }
 };

 const handleUpdateConnectionStatus = async (id, isActive) => {
 try {
 const res = await fetch(`/api/providers/${id}`, {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ isActive }),
 });
 if (res.ok) {
 setConnections(prev => prev.map(c => c.id === id ? { ...c, isActive } : c));
 }
 } catch (error) {
 console.log("Error updating connection status:", error);
 }
 };

 const handleSwapPriority = async (index1, index2) => {
 // Optimistic update state
 const newConnections = [...connections];
 [newConnections[index1], newConnections[index2]] = [newConnections[index2], newConnections[index1]];
 setConnections(newConnections);

 try {
 await Promise.all([
 fetch(`/api/providers/${newConnections[index1].id}`, {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ priority: index1 }),
 }),
 fetch(`/api/providers/${newConnections[index2].id}`, {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ priority: index2 }),
 }),
 ]);
 } catch (error) {
 console.log("Error swapping priority:", error);
 await fetchConnections();
 }
 };

 const selectedConnections = connections.filter((conn) => selectedConnectionIds.includes(conn.id));
 const allSelected = connections.length > 0 && selectedConnectionIds.length === connections.length;

 const toggleSelectConnection = (connectionId) => {
 setSelectedConnectionIds((prev) => (
 prev.includes(connectionId)
 ? prev.filter((id) => id !== connectionId)
 : [...prev, connectionId]
 ));
 };

 const toggleSelectAllConnections = () => {
 if (allSelected) {
 setSelectedConnectionIds([]);
 return;
 }
 setSelectedConnectionIds(connections.map((conn) => conn.id));
 };

 const clearSelection = () => {
 setSelectedConnectionIds([]);
 setBulkProxyPoolId("__none__");
 };

 useEffect(() => {
 setSelectedConnectionIds((prev) => {
 const next = prev.filter((id) => connections.some((conn) => conn.id === id));
 if (next.length === prev.length) return prev;
 return next;
 });
 }, [connections]);

 const selectedProxySummary = (() => {
 if (selectedConnections.length === 0) return"";
 const poolIds = new Set(selectedConnections.map((conn) => conn.providerSpecificData?.proxyPoolId ||"__none__"));
 if (poolIds.size === 1) {
 const onlyId = [...poolIds][0];
 if (onlyId ==="__none__") return"All selected currently unbound";
 const pool = proxyPools.find((p) => p.id === onlyId);
 return `All selected currently bound to ${pool?.name || onlyId}`;
 }
 return"Selected connections have mixed proxy bindings";
 })();

 const openBulkProxyModal = () => {
 if (selectedConnections.length === 0) return;
 const uniquePoolIds = [...new Set(selectedConnections.map((conn) => conn.providerSpecificData?.proxyPoolId ||"__none__"))];
 setBulkProxyPoolId(uniquePoolIds.length === 1 ? uniquePoolIds[0] :"__none__");
 setShowBulkProxyModal(true);
 };

 const closeBulkProxyModal = () => {
 if (bulkUpdatingProxy) return;
 setShowBulkProxyModal(false);
 };

 const handleBulkApplyProxyPool = async () => {
 if (selectedConnectionIds.length === 0) return;

 const proxyPoolId = bulkProxyPoolId ==="__none__"? null : bulkProxyPoolId;
 setBulkUpdatingProxy(true);
 try {
 const results = [];
 for (const connectionId of selectedConnectionIds) {
 try {
 const res = await fetch(`/api/providers/${connectionId}`, {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ proxyPoolId }),
 });
 results.push(res.ok);
 } catch (e) {
 console.log("Error applying bulk proxy pool for", connectionId, e);
 results.push(false);
 }
 }

 const failedCount = results.filter((ok) => !ok).length;
 if (failedCount > 0) {
 alert(`Updated with ${failedCount} failed request(s).`);
 }

 await fetchConnections();
 clearSelection();
 setShowBulkProxyModal(false);
 } catch (error) {
 console.log("Error applying bulk proxy pool:", error);
 } finally {
 setBulkUpdatingProxy(false);
 }
 };


 const isSelected = (connectionId) => selectedConnectionIds.includes(connectionId);

 const connectionsList = (
 <div className="flex flex-col divide-y divide-border">
 {connections
 .map((conn, index) => (
 <div key={conn.id} className="flex items-stretch">
 <div className="flex-1 min-w-0">
 <ConnectionRow
 connection={conn}
 proxyPools={proxyPools}
 isOAuth={isOAuth}
 isFirst={index === 0}
 isLast={index === connections.length - 1}
 onMoveUp={() => handleSwapPriority(index, index - 1)}
 onMoveDown={() => handleSwapPriority(index, index + 1)}
 onToggleActive={(isActive) => handleUpdateConnectionStatus(conn.id, isActive)}
 onUpdateProxy={async (proxyPoolId) => {
 try {
 const res = await fetch(`/api/providers/${conn.id}`, {
 method:"PUT",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ proxyPoolId: proxyPoolId || null }),
 });
 if (res.ok) {
 setConnections(prev => prev.map(c =>
 c.id === conn.id
 ? { ...c, providerSpecificData: { ...c.providerSpecificData, proxyPoolId: proxyPoolId || null } }
 : c
 ));
 }
 } catch (error) {
 console.log("Error updating proxy:", error);
 }
 }}
 onEdit={() => {
 setSelectedConnection(conn);
 setShowEditModal(true);
 }}
 onDelete={() => handleDelete(conn.id)}
 />
 </div>
 </div>
 ))}
 </div>
 );

 const bulkProxyOptions = [
 { value:"__none__", label:"None"},
 ...proxyPools.map((pool) => ({ value: pool.id, label: pool.name })),
 ];

 const bulkHint = selectedConnectionIds.length === 0
 ?"Select one or more connections, then click Proxy Action."
 : selectedProxySummary;

 const canApplyBulkProxy = selectedConnectionIds.length > 0 && !bulkUpdatingProxy;

 const bulkActionModal = (
 <Dialog
 open={showBulkProxyModal}
 onOpenChange={(open) => {
 if (!open) closeBulkProxyModal();
 }}
 >
 <DialogContent className="sm:max-w-md" showCloseButton>
 <DialogHeader>
 <DialogTitle>
 Proxy Action ({selectedConnectionIds.length} selected)
 </DialogTitle>
 </DialogHeader>
 <div className="flex flex-col gap-4">
 <div className="flex flex-col gap-2">
 <Label>Proxy Pool</Label>
 <Select
 value={bulkProxyPoolId}
 onValueChange={setBulkProxyPoolId}
 >
 <SelectTrigger className="w-full">
 <SelectValue placeholder="None"/>
 </SelectTrigger>
 <SelectContent>
 {bulkProxyOptions.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>
 {opt.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <p className="text-xs text-muted-foreground">{bulkHint}</p>
 <p className="text-xs text-muted-foreground">
 Selecting None will unbind selected connections from proxy pool.
 </p>
 </div>
 <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <Button
 type="button"
 variant="outline"
 onClick={closeBulkProxyModal}
 disabled={bulkUpdatingProxy}
 >
 Cancel
 </Button>
 <Button
 type="button"
 className="gap-2"
 onClick={handleBulkApplyProxyPool}
 disabled={!canApplyBulkProxy}
 >
 {bulkUpdatingProxy ? (
 <>
 <Spinner className="size-4 animate-spin" data-icon="inline-start"/>
 Applying...
 </>
 ) : (
"Apply"
 )}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 );

 const handleTestModel = async (modelId) => {
 if (testingModelId) return;
 setTestingModelId(modelId);
 try {
 const res = await fetch("/api/models/test", {
 method:"POST",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ model: `${providerStorageAlias}/${modelId}` }),
 });
 const data = await res.json();
 setModelTestResults((prev) => ({ ...prev, [modelId]: data.ok ?"ok":"error"}));
 setModelsTestError(data.ok ?"": (data.error ||"Model not reachable"));
 } catch {
 setModelTestResults((prev) => ({ ...prev, [modelId]:"error"}));
 setModelsTestError("Network error");
 } finally {
 setTestingModelId(null);
 }
 };

 const renderModelsSection = () => {
 if (isCompatible) {
 return (
 <CompatibleModelsSection
 providerStorageAlias={providerStorageAlias}
 providerDisplayAlias={providerDisplayAlias}
 modelAliases={modelAliases}
 copied={copied}
 onCopy={copy}
 onSetAlias={handleSetAlias}
 onDeleteAlias={handleDeleteAlias}
 connections={connections}
 isAnthropic={isAnthropicCompatible}
 />
 );
 }
 // Combine hardcoded models with Kilo free models (deduplicated)
 // Exclude non-llm models (embedding, tts, etc.) — they have dedicated pages under media-providers
 const displayModels = [
 ...models,
 ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id)),
 ].filter((m) => !m.type || m.type ==="llm");
 // Custom models added by user (stored as aliases: modelId → providerAlias/modelId)
 const customModels = Object.entries(modelAliases)
 .filter(([alias, fullModel]) => {
 const prefix = `${providerStorageAlias}/`;
 if (!fullModel.startsWith(prefix)) return false;
 const modelId = fullModel.slice(prefix.length);
 // Only show if not already in hardcoded list
 // For passthroughModels, include all aliases (model IDs may contain slashes like"anthropic/claude-3")
 if (providerInfo.passthroughModels) return !models.some((m) => m.id === modelId);
 return !models.some((m) => m.id === modelId) && alias === modelId;
 })
 .map(([alias, fullModel]) => ({
 id: fullModel.slice(`${providerStorageAlias}/`.length),
 alias,
 fullModel,
 }));

 return (
 <div className="flex flex-wrap gap-3">
 {displayModels.map((model) => {
 const fullModel = `${providerStorageAlias}/${model.id}`;
 const oldFormatModel = `${providerId}/${model.id}`;
 const existingAlias = Object.entries(modelAliases).find(
 ([, m]) => m === fullModel || m === oldFormatModel
 )?.[0];
 return (
 <ModelRow
 key={model.id}
 model={model}
 fullModel={`${providerDisplayAlias}/${model.id}`}
 alias={existingAlias}
 copied={copied}
 onCopy={copy}
 onSetAlias={(alias) => handleSetAlias(model.id, alias, providerStorageAlias)}
 onDeleteAlias={() => handleDeleteAlias(existingAlias)}
 testStatus={modelTestResults[model.id]}
 onTest={connections.length > 0 || isFreeNoAuth ? () => handleTestModel(model.id) : undefined}
 isTesting={testingModelId === model.id}
 isFree={model.isFree}
 />
 );
 })}

 {/* Custom models inline */}
 {customModels.map((model) => (
 <ModelRow
 key={model.id}
 model={{ id: model.id }}
 fullModel={`${providerDisplayAlias}/${model.id}`}
 alias={model.alias}
 copied={copied}
 onCopy={copy}
 onSetAlias={() => {}}
 onDeleteAlias={() => handleDeleteAlias(model.alias)}
 testStatus={modelTestResults[model.id]}
 onTest={connections.length > 0 || isFreeNoAuth ? () => handleTestModel(model.id) : undefined}
 isTesting={testingModelId === model.id}
 isCustom
 isFree={false}
 />
 ))}

 {/* Add model button — inline, same style as model chips */}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setShowAddCustomModel(true)}
 className="h-auto border-dashed py-2 text-xs rounded-none"
 >
 <Plus className="size-3.5" data-icon="inline-start"/>
 Add Model
 </Button>

 {/* Suggested models from provider API — show only models not yet added */}
 {suggestedModels.length > 0 && (() => {
 const addedFullModels = new Set(Object.values(modelAliases));
 const hardcodedIds = new Set(models.map((m) => m.id));
 const notAdded = suggestedModels.filter(
 (m) => !addedFullModels.has(`${providerStorageAlias}/${m.id}`) && !hardcodedIds.has(m.id)
 );
 if (notAdded.length === 0) return null;
 return (
 <div className="mt-2 w-full">
 <p className="mb-2 text-xs text-muted-foreground">
 {translate("Suggested free models")} (<span className="tabular-nums">≥200k</span> context):
 </p>
 <div className="flex flex-wrap gap-2">
 {notAdded.map((m) => (
 <Button
 key={m.id}
 type="button"
 variant="outline"
 size="sm"
 onClick={async () => {
 const alias = m.id.split("/").pop();
 await handleSetAlias(m.id, alias, providerStorageAlias);
 }}
 className="h-auto gap-1 px-2.5 py-1.5 text-xs font-normal rounded-none"
 title={`${m.name} · ${(m.contextLength / 1000).toFixed(0)}k ctx`}
 >
 <Plus className="size-3" data-icon="inline-start"/>
 {m.id.split("/").pop()}
 </Button>
 ))}
 </div>
 </div>
 );
 })()}
 </div>
 );
 };

 if (loading) {
 return (
 <div className="flex flex-col gap-8">
 <div className="flex flex-col gap-4">
 <Skeleton className="h-10 w-2/3 max-w-md"/>
 <Skeleton className="h-24 w-full rounded-xl"/>
 </div>
 <Skeleton className="h-64 w-full rounded-xl"/>
 </div>
 );
 }

 if (!providerInfo) {
 return (
 <div className="py-20 text-center">
 <p className="text-muted-foreground">Provider not found</p>
 <Link
 href="/dashboard/providers"
 className={cn(buttonVariants({ variant:"link"}),"mt-4")}
 >
 Back to Providers
 </Link>
 </div>
 );
 }

 // Determine icon path: OpenAI Compatible providers use specialized icons
 const getHeaderIconPath = () => {
 if (isOpenAICompatible && providerInfo.apiType) {
 return providerInfo.apiType ==="responses"?"/providers/oai-r.png":"/providers/oai-cc.png";
 }
 if (isAnthropicCompatible) {
 return"/providers/anthropic-m.png";
 }
 return `/providers/${providerInfo.id}.png`;
 };

 return (
 <div className="mx-auto max-w-5xl flex flex-col gap-5 py-4 px-4">
 {/* Page Header */}
 <header className="flex flex-col gap-3 pb-4 border-b border-border/50">
 <Link
 href="/dashboard/providers"
 className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
 >
 <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" weight="bold" />
 {translate("Back to Providers")}
 </Link>

 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-1">
 <div className="flex items-center gap-4">
 <div
 className="size-11 rounded-none flex items-center justify-center border border-border/50 bg-muted/5 shadow-none"
 style={{ backgroundColor: `${providerInfo.color}08` }}
 >
 {headerImgError ? (
 <span className="text-lg font-bold" style={{ color: providerInfo.color }}>
 {providerInfo.textIcon || providerInfo.id.slice(0, 2).toUpperCase()}
 </span>
 ) : (
 <Image
 src={getHeaderIconPath()}
 alt={providerInfo.name}
 width={32}
 height={32}
 className={cn(
 "object-contain max-w-[28px] max-h-[28px]",
 (providerInfo.id === "codex" || providerInfo.id === "openai" || providerInfo.id === "github") && "dark:invert"
 )}
 sizes="32px"
 onError={() => setHeaderImgError(true)}
 />
 )}
 </div>
 <div className="flex flex-col gap-0.5">
 <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-xs uppercase tracking-wider opacity-60">
 <ShieldCheck className="size-3.5" weight="bold" data-icon="inline-start"/>
 {translate("Infrastructure")}
 </div>
 <h1 className="text-xl font-semibold tracking-tight leading-none">{providerInfo.name}</h1>
 <p className="text-xs text-muted-foreground font-medium tabular-nums mt-1">
 {connections.length} {translate(connections.length === 1 ? "connection" : "connections")}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {isOAuth && (
 <Button 
 type="button"
 variant="outline" 
 size="sm" 
 onClick={() => setShowOAuthModal(true)} 
 className="font-semibold tracking-wide"
 >
 <Plus className="size-3.5" weight="bold" data-icon="inline-start" />
 {providerId === "iflow" ? "OAuth" : translate("Add Connection")}
 </Button>
 )}
 {!isOAuth && !isFreeNoAuth && !isCompatible && (
 <Button 
 type="button"
 variant="outline" 
 size="sm" 
 onClick={() => setShowAddApiKeyModal(true)} 
 className="font-semibold tracking-wide"
 >
 <Plus className="size-3.5" weight="bold" data-icon="inline-start" />
 {translate("Add Connection")}
 </Button>
 )}
 </div>
 </div>
 </header>

 {providerInfo.deprecated && (
 <Alert variant="destructive" className="border-orange-500/20 bg-orange-500/5">
 <Warning className="text-orange-500" weight="bold" />
 <AlertTitle className="text-orange-500">{translate("Deprecated")}</AlertTitle>
 <AlertDescription className="text-orange-500/90 text-xs font-medium leading-relaxed">
 {providerInfo.deprecationNotice}
 </AlertDescription>
 </Alert>
 )}

 {providerInfo.notice && !providerInfo.deprecated && (
 <Alert className="border-blue-500/20 bg-primary/10">
 <Info className="text-primary" weight="bold" />
 <AlertDescription className="text-primary text-xs font-medium leading-relaxed">
 {providerInfo.notice.text}
 </AlertDescription>
 {providerInfo.notice.apiKeyUrl && (
 <div className="mt-2">
 <a
 href={providerInfo.notice.apiKeyUrl}
 target="_blank"
 rel="noopener noreferrer"
 className={cn(
 buttonVariants({ size: "xs", variant: "secondary" }),
 "font-bold tracking-widest bg-primary/20 text-primary border-none hover:bg-primary/30",
 )}
 >
 Get API Key
 </a>
 </div>
 )}
 </Alert>
 )}

 {isCompatible && providerNode && (
 <Card className="p-3 rounded-none">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div className="min-w-0 flex flex-col gap-0.5">
 <h2 className="text-sm font-semibold tracking-tight">
 {isAnthropicCompatible
 ? translate("Anthropic Compatible Details")
 : translate("OpenAI Compatible Details")}
 </h2>
 <p className="text-xs text-muted-foreground tabular-nums">
 {isAnthropicCompatible
 ?"Messages API"
 : providerNode.apiType ==="responses"
 ?"Responses API"
 :"Chat Completions"}{""}
 · {(providerNode.baseUrl ||"").replace(/\/$/,"")}/
 {isAnthropicCompatible
 ?"messages"
 : providerNode.apiType ==="responses"
 ?"responses"
 :"chat/completions"}
 </p>
 </div>
 <div className="flex shrink-0 flex-wrap items-center gap-1.5">
 <Button
 size="xs"
 variant="outline"
 onClick={() => setShowAddApiKeyModal(true)}
 disabled={connections.length > 0}
 className="gap-1 font-semibold"
 >
 <Plus className="size-3" weight="bold" data-icon="inline-start"/>
 {translate("Add")}
 </Button>
 <Button
 size="xs"
 variant="secondary"
 onClick={() => setShowEditNodeModal(true)}
 className="gap-1 font-semibold"
 >
 <Pencil className="size-3" weight="bold" data-icon="inline-start"/>
 {translate("Edit")}
 </Button>
 <Button
 size="xs"
 variant="secondary"
 onClick={async () => {
 if (
 !confirm(
 translate(`Delete this ${isAnthropicCompatible ?"Anthropic":"OpenAI"} Compatible node?`),
 )
 )
 return;
 try {
 const res = await fetch(`/api/provider-nodes/${providerId}`, {
 method:"DELETE",
 });
 if (res.ok) {
 router.push("/dashboard/providers");
 }
 } catch (error) {
 console.log("Error deleting provider node:", error);
 }
 }}
 className="gap-1 font-semibold text-destructive hover:bg-destructive/10"
 >
 <Trash className="size-3" weight="bold" data-icon="inline-start"/>
 {translate("Delete")}
 </Button>
 </div>
 </div>
 {connections.length > 0 && (
 <p className="text-xs text-muted-foreground mt-1.5 opacity-70">
 {translate("Only one connection is allowed per compatible node.")}
 </p>
 )}
 </Card>
 )}

 {/* Connections */}
 {isFreeNoAuth ? (
 <Card className="p-4 border-border/50 shadow-none bg-muted/5 rounded-none">
 <div className="flex items-center gap-3">
 <div className="inline-flex size-9 items-center justify-center rounded-none bg-primary/10 text-primary border border-primary/20">
 <LockOpen className="size-5" weight="bold" />
 </div>
 <div className="flex flex-col gap-0.5">
 <p className="text-xs font-semibold">{translate("No authentication required")}</p>
 <p className="text-xs text-muted-foreground font-medium">
 {translate("This provider is ready to use.")}
 </p>
 </div>
 </div>
 </Card>
 ) : (
 <Card className="border-border/50 shadow-none overflow-hidden p-0 py-0 rounded-none">
 <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-3 py-2 border-b border-border/50 bg-muted/10">
 <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
 {translate("Connections")}
 </CardTitle>
 <div className="flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2">
 <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
 {translate("Round Robin")}
 </span>
 <Switch
 checked={providerStrategy === "round-robin"}
 onCheckedChange={handleRoundRobinToggle}
 className="scale-[0.55] origin-right data-[state=checked]:bg-primary"
 />
 {providerStrategy === "round-robin" && (
 <div className="flex items-center gap-1.5 ml-1">
 <span className="text-[10px] font-medium tracking-wide text-muted-foreground">Sticky:</span>
 <Input
 type="number"
 min={1}
 value={providerStickyLimit}
 onChange={(e) => handleStickyLimitChange(e.target.value)}
 placeholder="1"
 className="h-8 w-10 px-1 py-0.5 text-xs font-bold tabular-nums text-center bg-background border-border/50 rounded-none"
 />
 </div>
 )}
 </div>
 </div>
 </CardHeader>

 <CardContent className="p-0">
 {connections.length === 0 ? (
 <div className="py-10 text-center flex flex-col items-center justify-center opacity-30">
 <div className="mb-3 inline-flex size-11 items-center justify-center rounded-none bg-muted/10 border border-border/50">
 {isOAuth ? <Lock className="size-6" weight="bold" /> : <Key className="size-6" weight="bold" />}
 </div>
 <p className="text-xs font-medium tracking-tight">{translate("No connections yet")}</p>
 <p className="text-xs text-muted-foreground mt-0.5 mb-4">{translate("Add your first connection to get started")}</p>
 {!isCompatible && (
 <div className="flex justify-center gap-2">
 {providerId === "iflow" && (
 <Button 
 type="button"
 variant="secondary" 
 size="sm" 
 onClick={() => setShowIFlowCookieModal(true)} 
 className="font-semibold"
 >
 <Cookie className="size-3.5" weight="bold" data-icon="inline-start" />
 Cookie Auth
 </Button>
 )}
 <Button 
 type="button"
 variant="outline" 
 size="sm" 
 onClick={() => isOAuth ? setShowOAuthModal(true) : setShowAddApiKeyModal(true)} 
 className="font-semibold"
 >
 <Plus className="size-3.5" weight="bold" data-icon="inline-start" />
 {providerId === "iflow" ? "OAuth" : translate("Add Connection")}
 </Button>
 </div>
 )}
 </div>
 ) : (
 <div className="divide-y divide-border/50">
 {connectionsList}
 </div>
 )}
 </CardContent>
 
 {!isCompatible && connections.length > 0 && (
 <CardFooter className="px-3 py-1.5 border-t border-border/50 bg-muted/5 rounded-none">
 <div className="flex gap-2">
 {providerId === "iflow" && (
 <Button size="xs" variant="secondary" onClick={() => setShowIFlowCookieModal(true)} className="px-2.5 font-semibold">
 <Cookie className="size-3 mr-1" weight="bold" data-icon="inline-start" />
 Cookie
 </Button>
 )}
 <Button size="xs" variant="outline" onClick={() => isOAuth ? setShowOAuthModal(true) : setShowAddApiKeyModal(true)} className="px-2.5 font-semibold">
 <Plus className="size-3 mr-1" weight="bold" data-icon="inline-start" />
 {translate("Add")}
 </Button>
 </div>
 </CardFooter>
 )}
 </Card>
 )}

 {/* Models */}
 <Card className="border-border/50 shadow-none overflow-hidden p-0 py-0 rounded-none">
 <CardHeader className="px-3 py-2 border-b border-border/50 bg-muted/10">
 <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
 {translate("Available Models")}
 </CardTitle>
 </CardHeader>
 <CardContent className="p-3 bg-muted/5">
 {!!modelsTestError && (
 <Alert variant="destructive" className="mb-3 border-destructive/10 bg-destructive/5 py-1.5">
 <Warning className="size-4" weight="bold" />
 <AlertDescription className="text-xs font-medium leading-relaxed">
 {modelsTestError}
 </AlertDescription>
 </Alert>
 )}
 {renderModelsSection()}
 </CardContent>
 </Card>


 {bulkActionModal}

 {/* Modals */}
 {providerId ==="kiro"? (
 <KiroOAuthWrapper
 isOpen={showOAuthModal}
 providerInfo={providerInfo}
 onSuccess={handleOAuthSuccess}
 onClose={() => setShowOAuthModal(false)}
 />
 ) : providerId ==="cursor"? (
 <CursorAuthModal
 isOpen={showOAuthModal}
 onSuccess={handleOAuthSuccess}
 onClose={() => setShowOAuthModal(false)}
 />
 ) : providerId ==="gitlab"? (
 <GitLabAuthModal
 isOpen={showOAuthModal}
 providerInfo={providerInfo}
 onSuccess={handleOAuthSuccess}
 onClose={() => setShowOAuthModal(false)}
 />
 ) : (
 <OAuthModal
 isOpen={showOAuthModal}
 provider={providerId}
 providerInfo={providerInfo}
 onSuccess={handleOAuthSuccess}
 onClose={() => setShowOAuthModal(false)}
 />
 )}
 {providerId ==="iflow"&& (
 <IFlowCookieModal
 isOpen={showIFlowCookieModal}
 onSuccess={handleIFlowCookieSuccess}
 onClose={() => setShowIFlowCookieModal(false)}
 />
 )}
 <AddApiKeyModal
 isOpen={showAddApiKeyModal}
 provider={providerId}
 providerName={providerInfo.name}
 isCompatible={isCompatible}
 isAnthropic={isAnthropicCompatible}
 proxyPools={proxyPools}
 onSave={handleSaveApiKey}
 onClose={() => setShowAddApiKeyModal(false)}
 />
 <EditConnectionModal
 isOpen={showEditModal}
 connection={selectedConnection}
 proxyPools={proxyPools}
 onSave={handleUpdateConnection}
 onClose={() => setShowEditModal(false)}
 />
 {isCompatible && (
 <EditCompatibleNodeModal
 isOpen={showEditNodeModal}
 node={providerNode}
 onSave={handleUpdateNode}
 onClose={() => setShowEditNodeModal(false)}
 isAnthropic={isAnthropicCompatible}
 />
 )}
 {!isCompatible && (
 <AddCustomModelModal
 isOpen={showAddCustomModel}
 providerAlias={providerStorageAlias}
 providerDisplayAlias={providerDisplayAlias}
 onSave={async (modelId) => {
 // For passthrough providers (OpenRouter), use last segment as alias to avoid slash conflicts
 const alias = providerInfo?.passthroughModels
 ? modelId.split("/").pop()
 : modelId;
 await handleSetAlias(modelId, alias, providerStorageAlias);
 setShowAddCustomModel(false);
 }}
 onClose={() => setShowAddCustomModel(false)}
 />
 )}
 </div>
 );
}
