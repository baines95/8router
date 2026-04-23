"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Plus, 
  CloudArrowUp, 
  Upload, 
  ArrowsClockwise as RefreshCw, 
  Play, 
  Trash, 
  PencilSimple as Edit2, 
  Globe, 
  Pulse,
  WarningCircle as AlertCircle,
  CheckCircle,
  Sliders as Settings2,
  HardDrive as Server,
  Lightning as Zap,
  Info,
  Clock
} from "@phosphor-icons/react";
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
  if (status === "active") return <Badge className="bg-primary/10 text-primary border-none h-5 text-xs font-medium">ACTIVE</Badge>;
  if (status === "error") return <Badge variant="destructive" className="border-none h-5 text-xs font-medium">ERROR</Badge>;
  return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/20 h-5 text-xs font-medium uppercase">{status || "UNKNOWN"}</Badge>;
}

function formatDateTime(value) {
  if (!value) return "Chưa từng";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa từng";
  return date.toLocaleString("vi-VN");
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
        notify.success(editingProxyPool ? "Đã cập nhật Proxy pool" : "Đã tạo Proxy pool");
      } else {
        const data = await res.json();
        notify.error(data.error || "Không thể lưu proxy pool");
      }
    } catch (error) {
      notify.error("Không thể lưu proxy pool");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proxyPool) => {
    if (!confirm(`Xóa proxy pool "${proxyPool.name}"?`)) return;

    try {
      const res = await fetch(`/api/proxy-pools/${proxyPool.id}`, { method: "DELETE" });
      if (res.ok) {
        setProxyPools((prev) => prev.filter((item) => item.id !== proxyPool.id));
        notify.success("Đã xóa proxy pool");
        return;
      }
      const data = await res.json();
      notify.error(data.error || "Xóa thất bại");
    } catch (error) {
      notify.error("Không thể xóa proxy pool");
    }
  };

  const handleTest = async (proxyPoolId) => {
    setTestingId(proxyPoolId);
    try {
      const res = await fetch(`/api/proxy-pools/${proxyPoolId}/test`, { method: "POST" });
      const data = await res.json();
      await fetchProxyPools();
      if (data.ok) notify.success("Proxy test thành công");
      else notify.warning("Proxy test thất bại");
    } catch (error) {
      notify.error("Yêu cầu test thất bại");
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
        notify.success(`Đã deploy: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy thất bại");
      }
    } catch (error) {
      notify.error("Deploy thất bại");
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
        notify.success("Đã import proxy thành công");
      }
    } catch (error) {
      notify.error("Import thất bại");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 py-6 px-4">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs uppercase tracking-tight">
            <Globe className="size-4" weight="bold"/>
            Hệ thống
          </div>
          <h1 className="text-3xl font-medium tracking-tight">Proxy Pools</h1>
          <p className="text-sm text-muted-foreground font-medium">
            Quản lý proxy tái sử dụng và liên kết chúng với các kết nối provider.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-medium text-xs uppercase tracking-tight h-8 px-3" onClick={() => setShowVercelModal(true)}>
            <CloudArrowUp className="size-3.5 mr-2" weight="bold"/> Vercel Relay
          </Button>
          <Button variant="outline" size="sm" className="font-medium text-xs uppercase tracking-tight h-8 px-3" onClick={() => setShowBatchImportModal(true)}>
            <Upload className="size-3.5 mr-2" weight="bold"/> Batch Import
          </Button>
          <Button size="sm" className="font-medium text-xs uppercase tracking-tight h-8 px-3" onClick={() => { setEditingProxyPool(null); setFormData(normalizeFormData()); setShowFormModal(true); }}>
            <Plus className="size-3.5 mr-2" weight="bold"/> Add Pool
          </Button>
        </div>
      </header>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Tổng số Pool" value={proxyPools.length} icon={Server} />
        <StatCard label="Hoạt động" value={proxyPools.filter(p => p.isActive).length} icon={Zap} color="text-primary" />
        <StatCard label="Nút đã liên kết" value={proxyPools.reduce((acc, p) => acc + (p.boundConnectionCount || 0), 0)} icon={Pulse} color="text-primary" />
      </div>

      {/* Main List */}
      <Card className="border-border/50 overflow-hidden shadow-none">
        <CardHeader className="bg-muted/30 border-b border-border/50 py-3 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-tight text-muted-foreground">Danh sách Proxy</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proxyPools.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center opacity-30">
              <Globe className="size-12 mb-3" weight="bold"/>
              <p className="text-sm font-medium uppercase tracking-tight">Chưa đăng ký proxy nào</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {proxyPools.map((pool) => (
                <div key={pool.id} className="p-4 hover:bg-muted/30 transition-all flex items-center justify-between group">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{pool.name}</span>
                      {getStatusBadge(pool.testStatus)}
                      {pool.type === "vercel" && <Badge variant="secondary" className="h-4 text-xs font-semibold uppercase bg-primary/10 text-primary border-none">VERCEL</Badge>}
                      <Badge variant="outline" className="h-4 text-xs font-semibold border-border/50 text-muted-foreground tabular-nums">{pool.boundConnectionCount || 0} BOUND</Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate opacity-70">{pool.proxyUrl}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60 font-medium">
                      <Clock className="size-3" weight="bold"/>
                      Kiểm tra lần cuối: <span className="tabular-nums">{formatDateTime(pool.lastTestedAt)}</span>
                      {pool.lastError && <span className="text-destructive ml-1">· {pool.lastError}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Button variant="ghost" size="icon" className="size-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleTest(pool.id)} disabled={testingId === pool.id}>
                      {testingId === pool.id ? <RefreshCw className="size-3.5 animate-spin" weight="bold"/> : <Play className="size-3.5" weight="bold"/>}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingProxyPool(pool); setFormData(normalizeFormData(pool)); setShowFormModal(true); }}>
                      <Edit2 className="size-3.5" weight="bold"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(pool)}>
                      <Trash className="size-3.5" weight="bold"/>
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
        <DialogContent className="sm:max-w-md border-border/50 shadow-none">
          <DialogHeader>
            <DialogTitle>{editingProxyPool ? "Sửa Proxy Pool" : "Thêm Proxy Pool"}</DialogTitle>
            <DialogDescription>Cấu hình thiết lập proxy kết nối.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pool-name" className="text-xs font-medium uppercase tracking-tight text-muted-foreground">Tên Pool</Label>
              <Input id="pool-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. US West Proxy" className="h-10"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pool-url" className="text-xs font-medium uppercase tracking-tight text-muted-foreground">Proxy URL</Label>
              <Input id="pool-url" value={formData.proxyUrl} onChange={e => setFormData({ ...formData, proxyUrl: e.target.value })} placeholder="http://user:pass@host:port" className="font-mono text-xs h-10"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pool-noproxy" className="text-xs font-medium uppercase tracking-tight text-muted-foreground">Danh sách bỏ qua (No Proxy)</Label>
              <Input id="pool-noproxy" value={formData.noProxy} onChange={e => setFormData({ ...formData, noProxy: e.target.value })} placeholder="localhost, 127.0.0.1" className="font-mono text-xs h-10"/>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Strict Routing</Label>
                <p className="text-[10px] text-muted-foreground">Thất bại nếu proxy lỗi, không có fallback trực tiếp.</p>
              </div>
              <Switch checked={formData.strictProxy} onCheckedChange={v => setFormData({ ...formData, strictProxy: v })} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Hoạt động</Label>
              </div>
              <Switch checked={formData.isActive} onCheckedChange={v => setFormData({ ...formData, isActive: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-medium flex-1" onClick={() => setShowFormModal(false)}>Hủy</Button>
            <Button className="font-medium flex-1" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu cấu hình"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vercel Modal */}
      <Dialog open={showVercelModal} onOpenChange={setShowVercelModal}>
        <DialogContent className="sm:max-w-md border-border/50 shadow-none">
          <DialogHeader>
            <DialogTitle>Deploy Vercel Relay</DialogTitle>
            <DialogDescription>Ẩn IP của bạn qua Vercel Edge Network.</DialogDescription>
          </DialogHeader>
          <div className="bg-primary/10 border border-primary/10 p-3 rounded-lg flex gap-3">
            <Info className="size-4 text-primary shrink-0" weight="bold"/>
            <p className="text-xs leading-relaxed text-primary">Triển khai một edge function tới Vercel để định tuyến traffic qua các IP động của họ. Hữu ích để tránh bị chặn theo IP.</p>
          </div>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground">Vercel API Token</Label>
              <Input type="password" value={vercelForm.vercelToken} onChange={e => setVercelForm({ ...vercelForm, vercelToken: e.target.value })} className="h-10" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground">Tên dự án</Label>
              <Input value={vercelForm.projectName} onChange={e => setVercelForm({ ...vercelForm, projectName: e.target.value })} className="h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full font-medium h-10" onClick={handleVercelDeploy} disabled={deploying || !vercelForm.vercelToken.trim()}>
              {deploying ? "Đang triển khai..." : "Bắt đầu triển khai"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Import Modal */}
      <Dialog open={showBatchImportModal} onOpenChange={setShowBatchImportModal}>
        <DialogContent className="sm:max-lg border-border/50 shadow-none">
          <DialogHeader>
            <DialogTitle>Batch Import</DialogTitle>
            <DialogDescription>Dán danh sách proxy (mỗi dòng một proxy).</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea 
              className="w-full h-48 p-3 rounded-lg border border-border/50 bg-muted/50 font-mono text-xs focus:ring-1 focus:ring-primary/30 outline-none"
              placeholder={"protocol://user:pass@host:port\nhost:port:user:pass"}
              value={batchImportText}
              onChange={e => setBatchImportText(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-medium flex-1" onClick={() => setShowBatchImportModal(false)}>Hủy</Button>
            <Button className="font-medium px-8 flex-1" onClick={handleBatchImport} disabled={importing || !batchImportText.trim()}>Import tất cả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="border-border/50 bg-muted/20 shadow-none overflow-hidden">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">{label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <div className={cn("p-2 rounded-lg bg-background border border-border/50", color)}>
          <Icon className="size-4" weight="bold" />
        </div>
      </CardContent>
    </Card>
  );
}
