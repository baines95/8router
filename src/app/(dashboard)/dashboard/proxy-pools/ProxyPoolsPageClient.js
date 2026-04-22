"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Plus, 
  CloudUpload, 
  Upload, 
  RefreshCw, 
  Play, 
  Trash2, 
  Edit2, 
  Globe, 
  Activity,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Server,
  Zap,
  Info,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationStore } from "@/store/notificationStore";

function getStatusBadge(status) {
  if (status === "active") return <Badge className="bg-emerald-500/10 text-emerald-600 border-none h-5 text-[9px] font-bold">ACTIVE</Badge>;
  if (status === "error") return <Badge variant="destructive" className="border-none h-5 text-[9px] font-bold">ERROR</Badge>;
  return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/20 h-5 text-[9px] font-bold uppercase">{status || "UNKNOWN"}</Badge>;
}

function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

function normalizeFormData(data = {}) {
  return {
    name: data.name || "",
    proxyUrl: data.proxyUrl || "",
    noProxy: data.noProxy || "",
    isActive: data.isActive !== false,
    strictProxy: data.strictProxy === true,
  };
}

export default function ProxyPoolsPageClient({ initialData }) {
  const [proxyPools, setProxyPools] = useState(initialData?.proxyPools || []);
  const [loading, setLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [showVercelModal, setShowVercelModal] = useState(false);
  const [editingProxyPool, setEditingProxyPool] = useState(null);
  const [formData, setFormData] = useState(normalizeFormData());
  const [batchImportText, setBatchImportText] = useState("");
  const [vercelForm, setVercelForm] = useState({ vercelToken: "", projectName: "vercel-relay" });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const notify = useNotificationStore();

  const fetchProxyPools = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy-pools?includeUsage=true", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setProxyPools(data.proxyPools || []);
      }
    } catch (error) {
      console.log("Error fetching proxy pools:", error);
    }
  }, []);

  const handleSave = async () => {
    const payload = {
      ...formData,
      name: formData.name.trim(),
      proxyUrl: formData.proxyUrl.trim(),
    };

    if (!payload.name || !payload.proxyUrl) return;

    setSaving(true);
    try {
      const isEdit = !!editingProxyPool;
      const res = await fetch(isEdit ? `/api/proxy-pools/${editingProxyPool.id}` : "/api/proxy-pools", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchProxyPools();
        setShowFormModal(false);
        notify.success(editingProxyPool ? "Proxy pool updated" : "Proxy pool created");
      } else {
        const data = await res.json();
        notify.error(data.error || "Failed to save proxy pool");
      }
    } catch (error) {
      notify.error("Failed to save proxy pool");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proxyPool) => {
    if (!confirm(`Delete proxy pool \"${proxyPool.name}\"?`)) return;

    try {
      const res = await fetch(`/api/proxy-pools/${proxyPool.id}`, { method: "DELETE" });
      if (res.ok) {
        setProxyPools((prev) => prev.filter((item) => item.id !== proxyPool.id));
        notify.success("Proxy pool deleted");
        return;
      }
      const data = await res.json();
      notify.error(data.error || "Failed to delete");
    } catch (error) {
      notify.error("Failed to delete proxy pool");
    }
  };

  const handleTest = async (proxyPoolId) => {
    setTestingId(proxyPoolId);
    try {
      const res = await fetch(`/api/proxy-pools/${proxyPoolId}/test`, { method: "POST" });
      const data = await res.json();
      await fetchProxyPools();
      if (data.ok) notify.success("Proxy test passed");
      else notify.warning("Proxy test failed");
    } catch (error) {
      notify.error("Test request failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleVercelDeploy = async () => {
    if (!vercelForm.vercelToken.trim()) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/proxy-pools/vercel-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vercelForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProxyPools();
        setShowVercelModal(false);
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      notify.error("Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleBatchImport = async () => {
    const lines = batchImportText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    setImporting(true);
    try {
      const res = await fetch("/api/proxy-pools/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (res.ok) {
        await fetchProxyPools();
        setShowBatchImportModal(false);
        notify.success("Proxies imported successfully");
      }
    } catch (error) {
      notify.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 py-6 px-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
            <Globe className="size-4" />
            Infrastructure
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Proxy Pools</h1>
          <p className="text-sm text-muted-foreground font-medium">
            Manage reusable proxies and bind them to provider connections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-bold text-[10px] uppercase tracking-widest h-8 px-3" onClick={() => setShowVercelModal(true)}>
            <CloudUpload className="size-3 mr-2" /> Vercel Relay
          </Button>
          <Button variant="outline" size="sm" className="font-bold text-[10px] uppercase tracking-widest h-8 px-3" onClick={() => setShowBatchImportModal(true)}>
            <Upload className="size-3 mr-2" /> Batch Import
          </Button>
          <Button size="sm" className="font-bold text-[10px] uppercase tracking-widest h-8 px-3" onClick={() => { setEditingProxyPool(null); setFormData(normalizeFormData()); setShowFormModal(true); }}>
            <Plus className="size-3 mr-2" /> Add Pool
          </Button>
        </div>
      </header>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Pools" value={proxyPools.length} icon={Server} />
        <StatCard label="Active" value={proxyPools.filter(p => p.isActive).length} icon={Zap} color="text-emerald-500" />
        <StatCard label="Nodes Bound" value={proxyPools.reduce((acc, p) => acc + (p.boundConnectionCount || 0), 0)} icon={Activity} color="text-blue-500" />
      </div>

      {/* Main List */}
      <Card className="shadow-none border-border overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border py-3">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Registered Proxies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proxyPools.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center opacity-30">
               <Globe className="size-12 mb-3" />
               <p className="text-sm font-bold uppercase tracking-widest">No proxies registered</p>
            </div>
          ) : (
            <div className="divide-y border-border">
              {proxyPools.map((pool) => (
                <div key={pool.id} className="p-4 hover:bg-muted/30 transition-all flex items-center justify-between group">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold truncate">{pool.name}</span>
                      {getStatusBadge(pool.testStatus)}
                      {pool.type === "vercel" && <Badge variant="secondary" className="h-4 text-[8px] font-black uppercase bg-blue-500/10 text-blue-600 border-none">VERCEL</Badge>}
                      <Badge variant="outline" className="h-4 text-[8px] font-bold border-border text-muted-foreground">{pool.boundConnectionCount || 0} BOUND</Badge>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground truncate opacity-70">{pool.proxyUrl}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium">
                       <Clock className="size-3" />
                       Last tested: {formatDateTime(pool.lastTestedAt)}
                       {pool.lastError && <span className="text-red-400 ml-1">· {pool.lastError}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button variant="ghost" size="icon" className="size-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleTest(pool.id)} disabled={testingId === pool.id}>
                      {testingId === pool.id ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingProxyPool(pool); setFormData(normalizeFormData(pool)); setShowFormModal(true); }}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 hover:bg-red-500/10 hover:text-red-500" onClick={() => handleDelete(pool)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Modals --- */}
      
      {/* Form Modal */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProxyPool ? "Edit Proxy Pool" : "Add Proxy Pool"}</DialogTitle>
            <DialogDescription>Configure connection proxy settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pool-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pool Name</Label>
              <Input id="pool-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. US West Proxy" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pool-url" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Proxy URL</Label>
              <Input id="pool-url" value={formData.proxyUrl} onChange={e => setFormData({ ...formData, proxyUrl: e.target.value })} placeholder="http://user:pass@host:port" className="font-mono text-xs" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pool-noproxy" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Bypass List (No Proxy)</Label>
              <Input id="pool-noproxy" value={formData.noProxy} onChange={e => setFormData({ ...formData, noProxy: e.target.value })} placeholder="localhost, 127.0.0.1" className="font-mono text-xs" />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
               <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Strict Routing</Label>
                  <p className="text-[10px] text-muted-foreground">Fail if proxy is down, no direct fallback.</p>
               </div>
               <Switch checked={formData.strictProxy} onCheckedChange={v => setFormData({ ...formData, strictProxy: v })} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
               <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Enabled</Label>
               </div>
               <Switch checked={formData.isActive} onCheckedChange={v => setFormData({ ...formData, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="font-bold" onClick={() => setShowFormModal(false)}>Cancel</Button>
            <Button className="font-bold" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Configuration"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vercel Modal */}
      <Dialog open={showVercelModal} onOpenChange={setShowVercelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deploy Vercel Relay</DialogTitle>
            <DialogDescription>Mask your IP via Vercel Edge Network.</DialogDescription>
          </DialogHeader>
          <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg flex gap-3">
             <Info className="size-4 text-blue-500 shrink-0" />
             <p className="text-[10px] leading-relaxed text-blue-700 dark:text-blue-400">Deploy an edge function to Vercel to route traffic through their dynamic IPs. Useful for avoiding IP-based blocks.</p>
          </div>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vercel API Token</Label>
              <Input type="password" value={vercelForm.vercelToken} onChange={e => setVercelForm({ ...vercelForm, vercelToken: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project Name</Label>
              <Input value={vercelForm.projectName} onChange={e => setVercelForm({ ...vercelForm, projectName: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full font-bold" onClick={handleVercelDeploy} disabled={deploying || !vercelForm.vercelToken.trim()}>
              {deploying ? "Deploying Pipeline..." : "Initialize Deployment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Import Modal */}
      <Dialog open={showBatchImportModal} onOpenChange={setShowBatchImportModal}>
        <DialogContent className="sm:max-lg">
          <DialogHeader>
            <DialogTitle>Batch Import</DialogTitle>
            <DialogDescription>Paste multiple proxies (one per line).</DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <textarea 
                className="w-full h-48 p-3 rounded-lg border bg-muted/50 font-mono text-[10px] focus:ring-1 focus:ring-primary/30 outline-none"
                placeholder={"protocol://user:pass@host:port\nhost:port:user:pass"}
                value={batchImportText}
                onChange={e => setBatchImportText(e.target.value)}
             />
          </div>
          <DialogFooter>
             <Button variant="outline" className="font-bold" onClick={() => setShowBatchImportModal(false)}>Cancel</Button>
             <Button className="font-bold px-8" onClick={handleBatchImport} disabled={importing || !batchImportText.trim()}>Import All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="shadow-none border-border bg-muted/20">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-0.5">
           <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">{label}</p>
           <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        </div>
        <div className={cn("p-2 rounded-lg bg-background border border-border shadow-xs", color)}>
           <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
