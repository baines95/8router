"use client";

import { useState, useEffect, useRef } from"react";
import Link from"next/link";
import PropTypes from"prop-types";
import { 
 Card, 
 CardContent, 
 CardDescription, 
 CardFooter, 
 CardHeader, 
 CardTitle 
} from"@/components/ui/card";
import { Button, buttonVariants } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { 
 Dialog, 
 DialogContent, 
 DialogDescription, 
 DialogFooter, 
 DialogHeader, 
 DialogTitle 
} from"@/components/ui/dialog";
import { Skeleton } from"@/components/ui/skeleton";
import { Switch } from"@/components/ui/switch";
import { Label } from"@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from"@/components/ui/alert";
import { 
 Tooltip, 
 TooltipContent, 
 TooltipProvider, 
 TooltipTrigger 
} from"@/components/ui/tooltip";
import { Badge } from"@/components/ui/badge";
import { 
  Copy, 
  Check, 
  Power, 
  CircleNotch, 
  WarningCircle, 
  CloudArrowUp, 
  Shield, 
  Plus, 
  Key, 
  Eye, 
  EyeSlash, 
  Trash, 
  Warning, 
  CheckCircle, 
  Question, 
  Globe, 
  Users, 
  Code, 
  Lock,
  ArrowSquareOut,
  Pulse,
  Lightning,
  TerminalWindow,
  HardDrives,
  Network,
  Sliders,
  CaretRight
} from "@phosphor-icons/react";
import { translate } from "@/i18n/runtime";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";

const TUNNEL_BENEFITS = [
  { icon: Globe, title: "Access Anywhere", desc: "Use your API from any network" },
  { icon: Users, title: "Share Endpoint", desc: "Share URL with team members" },
  { icon: Code, title: "Use in Cursor/Cline", desc: "Connect AI tools remotely" },
  { icon: Lock, title: "Encrypted", desc: "End-to-end TLS via Cloudflare" },
];

export default function APIPageClient({ initialData }) {
  const { machineId } = initialData;
  const [keys, setKeys] = useState(initialData.keys || []);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);

  const [requireApiKey, setRequireApiKey] = useState(initialData.settings?.requireApiKey || false);
  const [requireLogin, setRequireLogin] = useState(initialData.settings?.requireLogin !== false);
  const [tunnelDashboardAccess, setTunnelDashboardAccess] = useState(initialData.settings?.tunnelDashboardAccess || false);

  const [tunnelEnabled, setTunnelEnabled] = useState(initialData.tunnel?.enabled || false);
  const [tunnelUrl, setTunnelUrl] = useState(initialData.tunnel?.tunnelUrl || "");
  const [tunnelPublicUrl, setTunnelPublicUrl] = useState(initialData.tunnel?.publicUrl || "");
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [showEnableTunnelModal, setShowEnableTunnelModal] = useState(false);
  const [showDisableTunnelModal, setShowDisableTunnelModal] = useState(false);

  const [tsEnabled, setTsEnabled] = useState(initialData.tailscale?.enabled || false);
  const [tsUrl, setTsUrl] = useState(initialData.tailscale?.tunnelUrl || "");
  const [tsLoading, setTsLoading] = useState(false);
  const [tsInstalled, setTsInstalled] = useState(null);
  const [showTsModal, setShowTsModal] = useState(false);
  const [showDisableTsModal, setShowDisableTsModal] = useState(false);

  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const { copied, copy } = useCopyToClipboard();
  const [baseUrl, setBaseUrl] = useState("/v1");

  useEffect(() => { 
    if (typeof window !== "undefined") {
      setBaseUrl(`${window.location.origin}/v1`);
    }
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsRes, statusRes] = await Promise.all([fetch("/api/settings"), fetch("/api/tunnel/status")]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setRequireApiKey(data.requireApiKey || false);
        setRequireLogin(data.requireLogin !== false);
        setTunnelDashboardAccess(data.tunnelDashboardAccess || false);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setTunnelUrl(data.tunnel?.tunnelUrl || "");
        setTunnelPublicUrl(data.tunnel?.publicUrl || "");
        setTsUrl(data.tailscale?.tunnelUrl || "");
        setTsEnabled(data.tailscale?.enabled || false);
        setTunnelEnabled(data.tunnel?.enabled || false);
      }
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleRequireApiKey = async (value) => {
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

  const handleDeleteKey = async (id) => {
    if (!confirm("Delete this API key?")) return;
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) setKeys(prev => prev.filter(k => k.id !== id));
    } catch (e) { console.log(e); }
  };

  const handleToggleKey = async (id, isActive) => {
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
  <Lightning className="size-4" weight="bold"/>
  Dịch vụ chính
  </div>
  <h1 className="text-3xl font-medium tracking-tight">Endpoint</h1>
  <p className="text-sm text-muted-foreground font-medium">
  {translate("Standard OpenAI-compatible endpoint for global infrastructure routing.")}
  </p>
  </div>

  <div className="flex items-center gap-2">
  <Badge variant="outline"className="bg-primary/10 text-primary border-primary/20 font-medium h-6 px-2">
  <Pulse className="size-3 mr-1.5" weight="bold" /> GATEWAY ACTIVE
  </Badge>
  </div>
  </header>

  {/* Connectivity URL Card */}
  <section>
  <Card className="border-border/50 bg-muted/10 overflow-hidden">
  <CardContent className="py-6 px-6">
  <div className="flex flex-col sm:flex-row items-center gap-1 overflow-hidden rounded-xl border border-border/50 bg-background/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
  <div className="relative flex-1 w-full group">
  <div className="absolute inset-y-0 left-4 flex items-center text-muted-foreground opacity-50"><TerminalWindow className="size-4" weight="bold" /></div>
  <Input value={currentPrimaryUrl} readOnly className="pl-11 h-12 font-mono text-sm border-none focus-visible:ring-0 bg-transparent" />
  </div>
  <Button size="lg" className="h-12 px-8 font-medium rounded-none border-l border-border/50 active:scale-[0.98] transition-transform" onClick={() => copy(currentPrimaryUrl, "primary_url")}>
  {copied === "primary_url" ? <Check className="mr-2 size-4" weight="bold" /> : <Copy className="mr-2 size-4" weight="bold" />}
  {copied === "primary_url" ? "Copied" : "Copy URL"}
  </Button>
  </div>
  </CardContent>
  </Card>
  </section>
      {/* Connectivity Nodes */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NodeCard title="Local Access" desc="Direct LAN connection." url={baseUrl} icon={HardDrives} badge="DEFAULT" active={true} color="blue" />
        <NodeCard title="Cloudflare Tunnel" desc="Public internet bridge." url={tunnelEnabled ? `${tunnelPublicUrl || tunnelUrl}/v1` : "Offline"} icon={CloudArrowUp} badge={tunnelEnabled ? "ACTIVE" : "OFFLINE"} active={tunnelEnabled} color="orange" onClick={() => tunnelEnabled ? setShowDisableTunnelModal(true) : setShowEnableTunnelModal(true)} />
        <NodeCard title="Tailscale Funnel" desc="Private mesh bridge." url={tsEnabled ? `${tsUrl}/v1` : "Offline"} icon={Shield} badge={tsEnabled ? "ACTIVE" : "OFFLINE"} active={tsEnabled} color="purple" onClick={() => tsEnabled ? setShowDisableTsModal(true) : setShowTsModal(true)} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Auth */}
        <Card className="lg:col-span-8 border-border/50 p-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-6 border-b">
            <div className="space-y-1">
              <CardTitle className="text-xl font-medium">Node Authentication</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Manage active security credentials.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddModal(true)} className="font-medium h-8 text-xs uppercase tracking-tight px-4">
              <Plus className="mr-1.5 size-3.5" weight="bold" /> New Token
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between p-4 mb-8 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex gap-4 items-center">
                <div className={cn("p-2 rounded-lg border bg-background", requireApiKey && "text-primary border-primary/20")}>
                  <Lock className="size-4" weight="bold" />
                </div>
                <div>
                  <p className="font-medium text-sm">Security Enforcement</p>
                  <p className="text-xs text-muted-foreground">Mandatory API key validation for all traffic.</p>
                </div>
              </div>
              <Switch checked={requireApiKey} onCheckedChange={handleRequireApiKey} className="scale-90" />
            </div>

            {keys.length === 0 ? (
              <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed border-border/50 flex flex-col items-center justify-center opacity-30 gap-3">
                <Key className="size-10" weight="bold" />
                <p className="text-xs font-medium uppercase tracking-tight">No access tokens defined</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div key={key.id} className={cn("flex items-center justify-between p-3.5 rounded-xl border border-border/50 hover:bg-muted/30 transition-all group", !key.isActive && "opacity-50 grayscale")}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs">{key.name}</span>
                        {!key.isActive && <Badge variant="outline" className="h-4 text-xs font-semibold uppercase">PAUSED</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground/70">{visibleKeys.has(key.id) ? key.key : key.key.slice(0, 8) + "..."}</code>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          <Button variant="ghost" size="icon" className="size-6" onClick={() => {
                            setVisibleKeys(prev => {
                              const next = new Set(prev);
                              if (next.has(key.id)) next.delete(key.id); else next.add(key.id);
                              return next;
                            });
                          }}>{visibleKeys.has(key.id) ? <EyeSlash className="size-3" weight="bold" /> : <Eye className="size-3" weight="bold" />}</Button>
                          <Button variant="ghost" size="icon" className="size-6" onClick={() => copy(key.key, key.id)}>{copied === key.id ? <Check className="size-3 text-primary" weight="bold" /> : <Copy className="size-3" weight="bold" />}</Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-4 border-l">
                      <Switch checked={key.isActive ?? true} onCheckedChange={(v) => handleToggleKey(key.id, v)} className="scale-75" />
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteKey(key.id)}><Trash className="size-3.5" weight="bold" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Tools */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="border-border/50 overflow-hidden p-0 bg-muted/5">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold uppercase tracking-tight text-muted-foreground/60 flex items-center gap-2"><TerminalWindow className="size-3.5" weight="bold" /> Integration</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3 bg-black rounded-xl font-mono text-xs text-primary/90 overflow-auto border border-white/5">
                <pre className="whitespace-pre-wrap break-all">{testCurl}</pre>
              </div>
              <p className="text-xs font-medium leading-relaxed text-muted-foreground/70">Test your node immediately using this cURL snippet. Standard API key required.</p>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs font-medium uppercase tracking-tight" onClick={() => copy(testCurl, "curl")}><Copy className="size-3 mr-2" weight="bold" /> Copy Script</Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 p-0 overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold uppercase tracking-tight text-muted-foreground/60 flex items-center gap-2"><Sliders className="size-3.5" weight="bold" /> Advanced</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Remote UI Access</span>
                <Switch checked={tunnelDashboardAccess} onCheckedChange={v => {
                  fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tunnelDashboardAccess: v }) }).then(() => setTunnelDashboardAccess(v));
                }} className="scale-75" />
              </div>
              <div className="flex items-center justify-between opacity-50 grayscale pointer-events-none">
                <span className="text-xs font-medium">Session Security</span>
                <Switch checked={true} disabled className="scale-75" />
              </div>
            </CardContent>
            <CardFooter className="p-3 border-t bg-muted/10">
              <Link 
                href="/dashboard/profile"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "w-full text-xs font-medium uppercase tracking-tight"
                )}
              >
                Security Settings <ArrowSquareOut className="ml-2 size-3" weight="bold" />
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-primary flex items-center gap-2"><CheckCircle className="size-5" weight="bold" /> Token Generated</DialogTitle><DialogDescription>Stored securely, only shown once.</DialogDescription></DialogHeader>
          <div className="p-4 bg-muted/50 rounded-xl font-mono text-sm border flex items-center justify-between gap-4 mt-4"><span className="truncate flex-1 font-medium text-primary">{createdKey}</span><Button variant="ghost" size="icon" onClick={() => copy(createdKey, "nk")}><Copy className="size-4" weight="bold" /></Button></div>
          <DialogFooter className="mt-4"><Button className="w-full font-medium h-11" onClick={() => setCreatedKey(null)}>I have saved it</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Access Token</DialogTitle><DialogDescription>Identify this client connection.</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2"><Label className="text-xs font-medium uppercase tracking-tight opacity-50">Token Label</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. Cursor IDE, Cline Agent" className="h-11 font-medium" autoFocus /></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button><Button onClick={handleCreateKey} disabled={!newKeyName.trim()}>Create Token</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEnableTunnelModal} onOpenChange={setShowEnableTunnelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Connect Cloudflare Tunnel</DialogTitle><DialogDescription>Securely expose your node.</DialogDescription></DialogHeader>
          <div className="py-4"><p className="text-xs text-muted-foreground leading-relaxed">This will initialize a cloudflared instance. Ensure "Global Authentication Policy" is active for security.</p></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowEnableTunnelModal(false)}>Cancel</Button><Button onClick={() => {
            setShowEnableTunnelModal(false);
            fetch("/api/tunnel/enable", { method: "POST" }).then(() => loadSettings());
          }}>Initialize Tunnel</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisableTunnelModal} onOpenChange={setShowDisableTunnelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Sever Connection?</DialogTitle><DialogDescription>Cloudflare gateway will be dropped.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowDisableTunnelModal(false)}>Cancel</Button><Button variant="destructive" onClick={() => {
            fetch("/api/tunnel/disable", { method: "POST" }).then(() => { setTunnelEnabled(false); setShowDisableTunnelModal(false); });
          }}>Disconnect</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function NodeCard({ title, desc, url, icon: Icon, badge, active, color, onClick }) {
  return (
    <Card className={cn("border-border/50 overflow-hidden transition-all", active && "ring-1 ring-primary/20 bg-primary/[0.02]")}>
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-2 rounded-lg border", active ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/50 text-muted-foreground")}><Icon className="size-5" weight="bold" /></div>
          <Badge variant="outline" className={cn("h-4 text-xs font-semibold border-none uppercase", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{badge}</Badge>
        </div>
        <CardTitle className="text-lg font-medium tracking-tight">{title}</CardTitle>
        <CardDescription className="text-xs font-medium text-muted-foreground">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <div className="p-2.5 bg-muted/30 rounded-lg font-mono text-xs text-muted-foreground border border-border/50 truncate">{url}</div>
      </CardContent>
      <CardFooter className="px-5 pb-5 pt-2">
        {onClick && <Button variant={active ? "outline" : "default"} size="sm" className="w-full h-8 text-xs font-medium uppercase tracking-tight" onClick={onClick}>{active ? "DISCONNECT" : "CONNECT NODE"}</Button>}
      </CardFooter>
    </Card>
  );
}


APIPageClient.propTypes = {
 initialData: PropTypes.object.isRequired,
};
