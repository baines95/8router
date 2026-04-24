"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import Link from "next/link";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CopyIcon,
  CheckIcon,
  CloudArrowUpIcon,
  ShieldIcon,
  PlusIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  CheckCircleIcon,
  LockSimpleIcon,
  ArrowSquareOutIcon,
  PulseIcon,
  LightningIcon,
  TerminalWindowIcon,
  HardDriveIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import { translate } from "@/i18n/runtime";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";

interface ApiKeyRecord {
  id: string;
  key: string;
  name: string;
  isActive?: boolean;
}

interface EndpointPageClientProps {
  initialData: {
    machineId: string;
    settings: {
      requireApiKey: boolean;
      requireLogin: boolean;
      tunnelDashboardAccess: boolean;
    };
    tunnel: {
      tunnelUrl: string;
      publicUrl: string;
      enabled: boolean;
    };
    tailscale: {
      tunnelUrl: string;
      enabled: boolean;
    };
    keys: ApiKeyRecord[];
  };
}

export default function APIPageClient({ initialData }: EndpointPageClientProps) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>(initialData.keys || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const [requireApiKey, setRequireApiKey] = useState(initialData.settings?.requireApiKey ?? false);
  const [tunnelDashboardAccess, setTunnelDashboardAccess] = useState(initialData.settings?.tunnelDashboardAccess ?? false);

  const [tunnelEnabled, setTunnelEnabled] = useState(initialData.tunnel?.enabled ?? false);
  const [tunnelUrl, setTunnelUrl] = useState(initialData.tunnel?.tunnelUrl ?? "");
  const [tunnelPublicUrl, setTunnelPublicUrl] = useState(initialData.tunnel?.publicUrl ?? "");
  const [settingsRefreshing, setSettingsRefreshing] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showEnableTunnelModal, setShowEnableTunnelModal] = useState(false);
  const [showDisableTunnelModal, setShowDisableTunnelModal] = useState(false);

  const [tsEnabled, setTsEnabled] = useState(initialData.tailscale?.enabled || false);
  const [tsUrl, setTsUrl] = useState(initialData.tailscale?.tunnelUrl || "");

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const { copied, copy } = useCopyToClipboard();

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "http://localhost:20128/v1";
    return `${window.location.origin}/v1`;
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsRefreshing(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([fetch("/api/settings"), fetch("/api/tunnel/status")]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const nextRequireApiKey = data.requireApiKey ?? false;
        const nextTunnelDashboardAccess = data.tunnelDashboardAccess ?? false;

        setRequireApiKey((prev) => (prev === nextRequireApiKey ? prev : nextRequireApiKey));
        setTunnelDashboardAccess((prev) => (prev === nextTunnelDashboardAccess ? prev : nextTunnelDashboardAccess));
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        const nextTunnelUrl = data.tunnel?.tunnelUrl ?? "";
        const nextTunnelPublicUrl = data.tunnel?.publicUrl ?? "";
        const nextTsUrl = data.tailscale?.tunnelUrl ?? "";
        const nextTsEnabled = data.tailscale?.enabled ?? false;
        const nextTunnelEnabled = data.tunnel?.enabled ?? false;

        setTunnelUrl((prev) => (prev === nextTunnelUrl ? prev : nextTunnelUrl));
        setTunnelPublicUrl((prev) => (prev === nextTunnelPublicUrl ? prev : nextTunnelPublicUrl));
        setTsUrl((prev) => (prev === nextTsUrl ? prev : nextTsUrl));
        setTsEnabled((prev) => (prev === nextTsEnabled ? prev : nextTsEnabled));
        setTunnelEnabled((prev) => (prev === nextTunnelEnabled ? prev : nextTunnelEnabled));
      }
      setSettingsLoaded(true);
    } catch (e) {
      console.log(e);
    } finally {
      setSettingsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loading = !settingsLoaded && settingsRefreshing;

  const handleRequireApiKey = async (value: boolean) => {
    try {
      const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requireApiKey: value }) });
      if (res.ok) setRequireApiKey(value);
    } catch (e) { console.log(e); }
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/keys");
      const data = await res.json();
      if (res.ok) setKeys(data.keys || []);
    } catch (e) { console.log(e); }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newKeyName }) });
      const data = await res.json();
      if (res.ok) { setCreatedKey(data.key); await fetchData(); setNewKeyName(""); setShowAddModal(false); }
    } catch (e) { console.log(e); }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Delete this API key?")) return;
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) setKeys(prev => prev.filter(k => k.id !== id));
    } catch (e) { console.log(e); }
  };

  const handleToggleKey = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
      if (res.ok) setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive } : k));
    } catch (e) { console.log(e); }
  };

  if (loading) return <div className="flex flex-col gap-6 max-w-7xl mx-auto py-10 px-4"><Skeleton className="h-48 w-full rounded-xl" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div></div>;

  const activePublicUrl = tunnelEnabled ? (tunnelPublicUrl || tunnelUrl) : tsEnabled ? tsUrl : null;
  const currentPrimaryUrl = activePublicUrl ? `${activePublicUrl}/v1` : baseUrl;

  const testCurl = `curl ${currentPrimaryUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${keys[0]?.key || "YOUR_API_KEY"}" \\
  -d '{
"model": "gpt-4o",
"messages": [{"role": "user", "content": "Hello!"}]
  }'`;

  return (
  <div className="mx-auto max-w-7xl flex flex-col gap-6 py-6 px-4 pb-12">

  {/* Page Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
  <div className="space-y-1">
  <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-tight">
  <LightningIcon className="size-4" weight="bold"/>
  Dịch vụ chính
  </div>
  <h1 className="text-3xl font-medium tracking-tight text-foreground">{translate("Endpoint")}</h1>
  <p className="text-sm text-muted-foreground font-medium">
  {translate("Standard OpenAI-compatible endpoint for global infrastructure routing.")}
  </p>
  </div>

  <div className="flex items-center gap-2">
  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-medium h-6 px-2 rounded-md border-none">
  <PulseIcon className="size-3 mr-1.5" weight="bold" /> GATEWAY ACTIVE
  </Badge>
  </div>
  </header>

  {/* Connectivity URL Card */}
  <section>
  <Card className="border-border/50 bg-muted/10 overflow-hidden rounded-md shadow-none">
  <CardContent className="py-6 px-6">
  <div className="flex flex-col sm:flex-row items-center gap-1 overflow-hidden rounded-md border border-border/50 bg-background/50 focus-within:ring-0 focus-within:border-primary/50 transition-all">
  <div className="relative flex-1 w-full group">
  <div className="absolute inset-y-0 left-4 flex items-center text-muted-foreground opacity-50"><TerminalWindowIcon className="size-4" weight="bold" /></div>
  <Input value={currentPrimaryUrl} readOnly className="pl-11 h-12 font-mono text-sm border-none focus-visible:ring-0 bg-transparent rounded-md" />
  </div>
  <Button size="lg" className="h-12 px-8 font-bold text-xs uppercase tracking-widest rounded-md border-l border-border/50 active:scale-[0.98] transition-transform shadow-none" onClick={() => copy(currentPrimaryUrl, "primary_url")}>
  {copied === "primary_url" ? <CheckIcon className="mr-2 size-4" weight="bold" /> : <CopyIcon className="mr-2 size-4" weight="bold" />}
  {copied === "primary_url" ? "Copied" : "Copy URL"}
  </Button>
  </div>
  </CardContent>
  </Card>
  </section>
      {/* Connectivity Nodes */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NodeCard title="Local Access" desc="Direct LAN connection." url={baseUrl} icon={HardDriveIcon} badge="DEFAULT" active={true} color="blue" />
        <NodeCard title="Cloudflare Tunnel" desc="Public internet bridge." url={tunnelEnabled ? `${tunnelPublicUrl || tunnelUrl}/v1` : "Offline"} icon={CloudArrowUpIcon} badge={tunnelEnabled ? "ACTIVE" : "OFFLINE"} active={tunnelEnabled} color="orange" onClick={() => tunnelEnabled ? setShowDisableTunnelModal(true) : setShowEnableTunnelModal(true)} />
        <NodeCard title="Tailscale Funnel" desc="Private mesh bridge." url={tsEnabled ? `${tsUrl}/v1` : "Offline"} icon={ShieldIcon} badge={tsEnabled ? "ACTIVE" : "OFFLINE"} active={tsEnabled} color="purple" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Auth */}
        <Card className="lg:col-span-8 border-border/50 p-0 overflow-hidden rounded-md shadow-none bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between p-6 border-b border-border/40 bg-muted/10">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase">Node Authentication</CardTitle>
              <CardDescription className="text-xs font-medium italic opacity-60">Manage active security credentials.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddModal(true)} className="font-bold h-8 text-xs uppercase tracking-widest px-4 rounded-md shadow-none">
              <PlusIcon className="mr-1.5 size-4" weight="bold" /> New Token
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between p-4 mb-8 rounded-md border border-border/50 bg-muted/20">
              <div className="flex gap-4 items-center">
                <div className={cn("p-2 rounded-md border border-border/50 bg-background shadow-none", requireApiKey && "text-primary border-primary/20")}>
                  <LockSimpleIcon className="size-4" weight="bold" />
                </div>
                <div>
                  <p className="font-bold text-xs uppercase tracking-widest text-foreground">Security Enforcement</p>
                  <p className="text-xs text-muted-foreground font-medium italic">Mandatory API key validation for all traffic.</p>
                </div>
              </div>
              <Switch checked={requireApiKey} onCheckedChange={handleRequireApiKey} className="scale-75 data-[state=checked]:bg-primary" />
            </div>

            {keys.length === 0 ? (
              <div className="text-center py-20 bg-muted/5 rounded-md border border-dashed border-border/40 flex flex-col items-center justify-center opacity-10 grayscale gap-3">
                <KeyIcon className="size-12" weight="bold" />
                <p className="text-xs font-bold uppercase tracking-[0.3em]">No access tokens defined</p>
              </div>
            ) : (
              <div className="space-y-2">
                {keys.map((key) => (
                  <div key={key.id} className={cn("flex items-center justify-between p-3.5 rounded-md border border-border/50 hover:bg-muted/30 transition-all group bg-background/50", !key.isActive && "opacity-50 grayscale")}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground uppercase tracking-tight">{key.name}</span>
                        {!key.isActive && <Badge variant="outline" className="h-4 px-1 text-xs font-bold uppercase border-border/40 text-muted-foreground/60 rounded-md">PAUSED</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground/60 tabular-nums">{visibleKeys.has(key.id) ? key.key : key.key.slice(0, 8) + "..."}</code>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          <Button variant="ghost" size="icon" className="size-7 rounded-md text-muted-foreground hover:text-foreground" onClick={() => {
                            setVisibleKeys(prev => {
                              const next = new Set(prev);
                              if (next.has(key.id)) next.delete(key.id); else next.add(key.id);
                              return next;
                            });
                          }}>{visibleKeys.has(key.id) ? <EyeSlashIcon className="size-4" weight="bold" /> : <EyeIcon className="size-4" weight="bold" />}</Button>
                          <Button variant="ghost" size="icon" className="size-7 rounded-md text-muted-foreground hover:text-primary" onClick={() => copy(key.key, key.id)}>{copied === key.id ? <CheckIcon className="size-4 text-primary" weight="bold" /> : <CopyIcon className="size-4" weight="bold" />}</Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-4 border-l border-border/20">
                      <Switch checked={key.isActive ?? true} onCheckedChange={(v) => handleToggleKey(key.id, v)} className="scale-[0.7] data-[state=checked]:bg-primary" />
                      <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground hover:text-destructive border border-transparent hover:border-border/50" onClick={() => handleDeleteKey(key.id)}><TrashIcon className="size-4" weight="bold" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Tools */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="border-border/50 overflow-hidden p-0 bg-muted/5 rounded-md shadow-none">
            <CardHeader className="p-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 flex items-center gap-2"><TerminalWindowIcon className="size-4" weight="bold" /> Infrastructure Test</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3 bg-black rounded-md font-mono text-xs text-primary/80 overflow-auto border border-white/5 shadow-inner">
                <pre className="whitespace-pre-wrap break-all leading-relaxed">{testCurl}</pre>
              </div>
              <p className="text-xs font-medium leading-relaxed text-muted-foreground italic opacity-70">Execute this cURL snippet to verify node connectivity. Credentials required.</p>
              <Button variant="outline" size="sm" className="w-full h-9 text-xs font-bold uppercase tracking-widest rounded-md border-border/50 bg-background hover:bg-muted/10 transition-colors" onClick={() => copy(testCurl, "curl")}><CopyIcon className="size-4 mr-2" weight="bold" /> Copy Script</Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 p-0 overflow-hidden rounded-md shadow-none">
            <CardHeader className="p-4 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 flex items-center gap-2"><SlidersHorizontalIcon className="size-4" weight="bold" /> Advanced Control</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-tight">Remote UI Access</span>
                <Switch checked={tunnelDashboardAccess} onCheckedChange={v => {
                  fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tunnelDashboardAccess: v }) }).then(() => setTunnelDashboardAccess(v));
                }} className="scale-[0.7] data-[state=checked]:bg-primary" />
              </div>
              <div className="flex items-center justify-between opacity-30 grayscale pointer-events-none">
                <span className="text-xs font-bold text-foreground uppercase tracking-tight">Session Obfuscation</span>
                <Switch checked={true} disabled className="scale-[0.7]" />
              </div>
            </CardContent>
            <CardFooter className="p-3 border-t border-border/20 bg-muted/10">
              <Link 
                href="/dashboard/profile"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "w-full text-xs font-bold uppercase tracking-widest h-8 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                )}
              >
                Global Security <ArrowSquareOutIcon className="ml-2 size-4" weight="bold" />
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent className="sm:max-w-md rounded-md border-border/50 shadow-none p-6">
          <DialogHeader><DialogTitle className="text-primary flex items-center gap-2 uppercase tracking-tight"><CheckCircleIcon className="size-5" weight="bold" /> Token Generated</DialogTitle><DialogDescription className="text-xs font-medium italic opacity-60">Provisioned successfully. Stored in vault, only shown once.</DialogDescription></DialogHeader>
          <div className="p-4 bg-muted/10 rounded-md font-mono text-sm border border-primary/20 flex items-center justify-between gap-4 mt-4 shadow-inner"><span className="truncate flex-1 font-bold text-primary tabular-nums">{createdKey}</span><Button variant="ghost" size="icon" className="rounded-md text-primary hover:bg-primary/10 border border-primary/10" onClick={() => copy(createdKey as string, "nk")}><CopyIcon className="size-4" weight="bold" /></Button></div>
          <DialogFooter className="mt-6 p-0 border-none"><Button className="w-full font-bold text-xs uppercase tracking-widest h-11 rounded-md shadow-none" onClick={() => setCreatedKey(null)}>I have saved it</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md rounded-md border-border/50 shadow-none p-6">
          <DialogHeader className="mb-4"><DialogTitle className="uppercase tracking-tight">New Access Token</DialogTitle><DialogDescription className="text-xs font-medium italic opacity-60">Identity string for this client connection.</DialogDescription></DialogHeader>
          <div className="py-2 space-y-2"><Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-50 px-1">Token Label</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. Cursor IDE, Cline Agent" className="h-11 font-bold uppercase tracking-tight rounded-md border-border/50 bg-muted/5" autoFocus /></div>
          <DialogFooter className="gap-2 sm:gap-2 mt-4 p-0"><Button variant="outline" className="font-bold text-xs uppercase tracking-widest flex-1 h-10 rounded-md border-border/50" onClick={() => setShowAddModal(false)}>Cancel</Button><Button className="font-bold text-xs uppercase tracking-widest flex-1 h-10 rounded-md shadow-none" onClick={handleCreateKey} disabled={!newKeyName.trim()}>Create Token</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEnableTunnelModal} onOpenChange={setShowEnableTunnelModal}>
        <DialogContent className="sm:max-w-md rounded-md border-border/50 shadow-none p-6">
          <DialogHeader className="mb-4"><DialogTitle className="uppercase tracking-tight">Provision Cloudflare Tunnel</DialogTitle><DialogDescription className="text-xs font-medium italic opacity-60">Expose node via secure Cloudflare bridge.</DialogDescription></DialogHeader>
          <div className="py-2"><p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/50 pl-3">This will initialize a high-availability cloudflared instance. Ensure &quot;Security Enforcement&quot; is active above before provisioning.</p></div>
          <DialogFooter className="gap-2 sm:gap-2 mt-4 p-0"><Button variant="outline" className="font-bold text-xs uppercase tracking-widest flex-1 h-10 rounded-md border-border/50" onClick={() => setShowEnableTunnelModal(false)}>Cancel</Button><Button className="font-bold text-xs uppercase tracking-widest flex-1 h-10 rounded-md shadow-none" onClick={() => {
            setShowEnableTunnelModal(false);
            fetch("/api/tunnel/enable", { method: "POST" }).then(() => loadSettings());
          }}>Initialize Tunnel</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisableTunnelModal} onOpenChange={setShowDisableTunnelModal}>
        <DialogContent className="sm:max-w-md rounded-md border-border/50 shadow-none p-6">
          <DialogHeader className="mb-4"><DialogTitle className="uppercase tracking-tight text-destructive">Terminate Tunnel?</DialogTitle><DialogDescription className="text-xs font-medium italic opacity-60">The public bridge will be severed immediately.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2 mt-4 p-0"><Button variant="outline" className="font-bold text-xs uppercase tracking-widest flex-1 h-10 rounded-md border-border/50" onClick={() => setShowDisableTunnelModal(false)}>Cancel</Button><Button variant="destructive" className="font-bold text-xs uppercase tracking-widest flex-1 h-10 rounded-md border-none shadow-none bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => {
            fetch("/api/tunnel/disable", { method: "POST" }).then(() => { setTunnelEnabled(false); setShowDisableTunnelModal(false); });
          }}>Terminate Bridge</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

interface NodeCardProps {
  title: string;
  desc: string;
  url: string;
  icon: ComponentType<IconProps>;
  badge: string;
  active: boolean;
  color: string;
  onClick?: () => void;
}

function NodeCard({ title, desc, url, icon: Icon, badge, active, color, onClick }: NodeCardProps) {
  void color;
  return (
    <Card className={cn("border-border/50 overflow-hidden transition-all rounded-md shadow-none bg-background/50", active && "border-primary/20 bg-primary/[0.01]")}>
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-2 rounded-md border border-border/50 bg-muted/10 shadow-none", active ? "text-primary border-primary/20 bg-primary/5" : "text-muted-foreground")}>
            <Icon className="size-5" weight="bold" />
          </div>
          <Badge variant="outline" className={cn("h-4 px-1.5 text-xs font-bold uppercase border-none rounded-md tracking-widest", active ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground/60")}>{badge}</Badge>
        </div>
        <CardTitle className="text-sm font-bold uppercase tracking-tight text-foreground">{title}</CardTitle>
        <CardDescription className="text-xs font-medium italic opacity-60 mt-0.5">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <div className="p-2.5 bg-muted/20 rounded-md font-mono text-xs text-muted-foreground/80 border border-border/40 truncate tabular-nums shadow-inner">{url}</div>
      </CardContent>
      <CardFooter className="px-5 pb-5 pt-2">
        {onClick && <Button variant={active ? "outline" : "default"} size="sm" className="w-full h-8 text-xs font-bold uppercase tracking-widest rounded-md border-border/50 shadow-none" onClick={onClick}>{active ? "TERMINATE" : "CONNECT"}</Button>}
      </CardFooter>
    </Card>
  );
}
