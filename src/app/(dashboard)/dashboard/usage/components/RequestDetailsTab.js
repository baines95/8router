"use client";

import { useState, useEffect, useCallback } from "react";
import { 
 CaretRight as ChevronRight, 
 MagnifyingGlass as Search, 
 ArrowCounterClockwise as RotateCcw, 
 ArrowSquareOut as ExternalLink, 
 Clock, 
 Lightning as Zap, 
 Database, 
 ArrowUp, 
 ArrowDown, 
 ChartLineUp as Pulse,
 ClockCounterClockwise as History,
 BracketsCurly as FileJson,
 Translate as Languages,
 Code as Code2,
 Terminal,
 Brain as BrainCircuit,
 Funnel as Filter,
 X,
 ArrowsClockwise as RefreshCw
} from "@phosphor-icons/react";
import { cn } from"@/lib/utils";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { 
 Sheet, 
 SheetContent, 
 SheetHeader, 
 SheetTitle, 
 SheetDescription,
 SheetScrollArea
} from"@/components/ui/sheet";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Input } from"@/components/ui/input";
import { ScrollArea } from"@/components/ui/scroll-area";
import { AI_PROVIDERS, getProviderByAlias } from"@/shared/constants/providers";

let providerNameCache = null;
let providerNodesCache = null;

async function fetchProviderNames() {
 if (providerNameCache && providerNodesCache) return { providerNameCache, providerNodesCache };
 const nodesRes = await fetch("/api/provider-nodes");
 const nodesData = await nodesRes.json();
 const nodes = nodesData.nodes || [];
 providerNodesCache = {};
 for (const node of nodes) { providerNodesCache[node.id] = node.name; }
 providerNameCache = { ...AI_PROVIDERS, ...providerNodesCache };
 return { providerNameCache, providerNodesCache };
}

function getProviderName(providerId, cache) {
 if (!providerId || !cache) return providerId;
 const cached = cache[providerId];
 if (typeof cached === 'string') return cached;
 if (cached?.name) return cached.name;
 const providerConfig = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
 return providerConfig?.name || providerId;
}

function CollapsibleSection({ title, children, defaultOpen = false, icon: Icon = null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/40 rounded-none overflow-hidden bg-muted/5">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/10 transition-colors">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-3.5 text-muted-foreground" weight="bold"/>}
          <span className="font-semibold text-xs capitalize text-muted-foreground">{title}</span>
        </div>
        <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-90")} />
      </button>
      {isOpen && <div className="p-4 border-t border-border/40 bg-background">{children}</div>}
    </div>
  );
}

function getInputTokens(tokens) {
 const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
 const cache = tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
 return prompt < cache ? cache : prompt;
}

export default function RequestDetailsTab() {
 const [details, setDetails] = useState([]);
 const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
 const [loading, setLoading] = useState(false);
 const [selectedDetail, setSelectedDetail] = useState(null);
 const [isSheetOpen, setIsSheetOpen] = useState(false);
 const [providers, setProviders] = useState([]);
 const [providerNameCache, setProviderNameCache] = useState(null);
 const [filters, setFilters] = useState({ provider:"", startDate:"", endDate:""});

 const fetchProviders = useCallback(async () => {
 try {
 const res = await fetch("/api/usage/providers");
 const data = await res.json();
 setProviders(data.providers || []);
 const cache = await fetchProviderNames();
 setProviderNameCache(cache.providerNameCache);
 } catch (error) { console.error(error); }
 }, []);

 const fetchDetails = useCallback(async () => {
 setLoading(true);
 try {
 const params = new URLSearchParams({ page: pagination.page.toString(), pageSize: pagination.pageSize.toString() });
 if (filters.provider) params.append("provider", filters.provider);
 if (filters.startDate) params.append("startDate", filters.startDate);
 if (filters.endDate) params.append("endDate", filters.endDate);
 const res = await fetch(`/api/usage/request-details?${params}`);
 const data = await res.json();
 setDetails(data.details || []);
 setPagination(prev => ({ ...prev, ...data.pagination }));
 } catch (error) { console.error(error); } finally { setLoading(false); }
 }, [pagination.page, pagination.pageSize, filters]);

 useEffect(() => { fetchProviders(); }, [fetchProviders]);
 useEffect(() => { fetchDetails(); }, [fetchDetails]);

 return (
 <div className="flex flex-col gap-6">
 {/* Filters Toolbar */}
 <Card className="border-border/40 bg-background/50 shadow-none">
 <CardContent className="p-3 flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2">
 <Filter className="size-3.5 text-muted-foreground" weight="bold"/>
 <span className="text-xs font-semibold text-foreground capitalize mr-2">Bộ lọc</span>
 </div>

 <Select value={filters.provider} onValueChange={v => setFilters({ ...filters, provider: v })}>
 <SelectTrigger className="h-8 text-xs font-semibold capitalize w-[180px] bg-background/50 border-border/40"><SelectValue placeholder="Tất cả Providers"/></SelectTrigger>
 <SelectContent>{providers.map(p => <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>)}</SelectContent>
 </Select>

 <Input type="datetime-local"value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="h-8 text-xs w-[180px] bg-background/50 font-mono border-border/40"/>
 <span className="text-muted-foreground text-xs font-medium">Đến</span>
 <Input type="datetime-local"value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="h-8 text-xs w-[180px] bg-background/50 font-mono border-border/40"/>

 <Button variant="ghost"size="sm"className="h-8 text-xs font-semibold capitalize ml-auto"onClick={() => setFilters({ provider:"", startDate:"", endDate:""})} disabled={!filters.provider && !filters.startDate && !filters.endDate}>
 <RotateCcw className="size-3.5 mr-2" weight="bold"/> Reset
 </Button>
 </CardContent>
 </Card>

      {/* Main Table */}
      <Card className="border-border/40 bg-background/50 shadow-none overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/10 border-b border-border/40 text-xs font-semibold capitalize text-muted-foreground">
            <tr>
            <th className="text-left px-3 py-2">Thời gian</th>
            <th className="text-left px-3 py-2">Model Pipeline</th>
            <th className="text-left px-3 py-2">Provider</th>
            <th className="text-right px-3 py-2">Input</th>
            <th className="text-right px-3 py-2">Output</th>
            <th className="text-left px-3 py-2">Độ trễ (TTFT/Tổng)</th>
            <th className="text-center px-3 py-2">Chi tiết</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
            {loading ? (
            <tr><td colSpan="7" className="px-3 py-20 text-center text-muted-foreground"><RefreshCw className="size-6 animate-spin mx-auto mb-2 opacity-20"/><p className="text-xs font-medium capitalize">Đang tải dữ liệu log...</p></td></tr>
            ) : details.length === 0 ? (
            <tr><td colSpan="7" className="px-3 py-20 text-center opacity-20 text-xs font-medium capitalize">Không tìm thấy traffic logs</td></tr>
            ) : details.map((d, i) => (

                <tr key={`${d.id}-${i}`} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-3 py-2 text-xs font-medium tabular-nums text-muted-foreground/60">{new Date(d.timestamp).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-xs">{d.model}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="h-4 text-xs font-medium capitalize border-border/40 bg-muted/40 text-muted-foreground/60">
                      {getProviderName(d.provider, providerNameCache)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium text-muted-foreground/60">{getInputTokens(d.tokens).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-medium text-muted-foreground/60">{(d.tokens?.completion_tokens || 0).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5 text-xs tabular-nums font-medium text-muted-foreground/60">
                      <span>{d.latency?.ttft || 0}ms <span className="text-xs opacity-50 capitalize">TTFT</span></span>
                      <span>{d.latency?.total || 0}ms <span className="text-xs opacity-50 capitalize">TOTAL</span></span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button variant="ghost" size="icon" className="size-8 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary" onClick={() => { setSelectedDetail(d); setIsSheetOpen(true); }}>
                      <ExternalLink className="size-3.5"/>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

 {/* Basic Pagination (To be replaced by standardized component if exists) */}
 {!loading && details.length > 0 && (
 <div className="p-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
 <span className="text-xs font-semibold capitalize text-muted-foreground">Trang {pagination.page} / {pagination.totalPages}</span>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" className="h-7 text-xs font-semibold capitalize rounded-none" onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page <= 1}>TRƯỚC</Button>
 <Button variant="outline" size="sm" className="h-7 text-xs font-semibold capitalize rounded-none" onClick={() => setPagination(p => ({ ...p, page: Math.min(pagination.totalPages, p.page + 1) }))} disabled={pagination.page >= pagination.totalPages}>SAU</Button>
 </div>
 </div>
 )}
 </Card>

 {/* Inspector Sheet */}
 <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
 <SheetContent className="sm:max-w-xl border-l border-border/40 p-0 flex flex-col">
 <SheetHeader className="px-6 py-4 border-b border-border/40 bg-muted/10 shrink-0">
 <div className="flex items-center gap-2 text-primary mb-1">
 <History className="size-3.5" weight="bold"/>
 <span className="text-xs font-semibold capitalize">Transaction Log</span>
 </div>
 <SheetTitle className="text-xl font-semibold tracking-tight">Chi tiết yêu cầu</SheetTitle>
 <SheetDescription className="text-xs text-muted-foreground">Kiểm tra logic định tuyến và phản hồi API.</SheetDescription>
 </SheetHeader>

 <ScrollArea className="flex-1">
 {selectedDetail && (
 <div className="p-6 space-y-8 pb-10">
 {/* Meta Grid */}
 <div className="grid grid-cols-2 gap-y-6 gap-x-4">
 <MetaItem label="ID Yêu cầu"value={selectedDetail.id} mono />
 <MetaItem label="Thời gian"value={new Date(selectedDetail.timestamp).toLocaleString("vi-VN")} />
 <MetaItem label="Model"value={selectedDetail.model} mono />
 <MetaItem label="Nhà cung cấp"value={getProviderName(selectedDetail.provider, providerNameCache)} />
 <div className="space-y-1">
 <span className="text-xs font-medium text-muted-foreground capitalize">Trạng thái</span>
 <div><Badge className={cn("border-none h-5 text-xs font-medium capitalize", selectedDetail.status === 'success' ?"bg-primary/10 text-primary":"bg-destructive/10 text-destructive")}>{selectedDetail.status === 'success' ?"Thành công":"Thất bại"}</Badge></div>
 </div>
 <div className="space-y-1">
 <span className="text-xs font-medium text-muted-foreground capitalize">Độ trễ</span>
 <div className="text-sm font-semibold tabular-nums">{selectedDetail.latency?.total || 0}ms</div>
 </div>
 </div>

 {/* Data Flow Layers */}
 <div className="space-y-4 pt-4 border-t border-border/40">
 <CollapsibleSection title="Yêu cầu (Client)"defaultOpen icon={FileJson}>
 <CodeBlock content={selectedDetail.request} />
 </CollapsibleSection>

 {selectedDetail.providerRequest && (
 <CollapsibleSection title="Định tuyến (Provider)"icon={Languages}>
 <CodeBlock content={selectedDetail.providerRequest} />
 </CollapsibleSection>
 )}

 {selectedDetail.providerResponse && (
 <CollapsibleSection title="Phản hồi (Provider)"icon={Code2}>
 <CodeBlock content={selectedDetail.providerResponse} />
 </CollapsibleSection>
 )}

 <CollapsibleSection title="Phản hồi (Client)"defaultOpen icon={Terminal}>
 {selectedDetail.response?.thinking && (
 <div className="mb-4 space-y-2">
 <div className="flex items-center gap-2 text-muted-foreground/80">
 <BrainCircuit className="size-4"/>
 <span className="text-xs font-medium">Cognitive Chain (Thinking)</span>
 </div>
 <pre className="p-4 rounded-xl bg-muted/30 border border-border/40 text-xs leading-relaxed font-mono text-muted-foreground/80 dark:text-muted-foreground/80 whitespace-pre-wrap">{selectedDetail.response.thinking}</pre>
 </div>
 )}
 <CodeBlock content={selectedDetail.response?.content ||"[Không có nội dung]"} />
 </CollapsibleSection>
 </div>
 </div>
 )}
 </ScrollArea>
 </SheetContent>
 </Sheet>
 </div>
 );
}

function MetaItem({ label, value, mono = false }) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground capitalize">{label}</p>
      <p className={cn("text-xs font-semibold truncate text-foreground", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

function CodeBlock({ content }) {
 const text = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
 return (
 <pre className="p-4 rounded-xl bg-muted/40 border border-border/50 font-mono text-xs leading-relaxed text-foreground/80 overflow-auto max-h-[400px] no-scrollbar">
 {text}
 </pre>
 );
}
