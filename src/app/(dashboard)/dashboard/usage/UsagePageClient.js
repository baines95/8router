"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Activity, 
  BarChart3, 
  Clock, 
  Cpu, 
  Database, 
  History, 
  Zap, 
  Key,
  TrendingUp, 
  Filter,
  Server,
  Network,
  Terminal,
  ChevronRight,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  Search
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import RequestDetailsTab from "./components/RequestDetailsTab";
import ProviderTopology from "./components/ProviderTopology";
import UsageChart from "./components/UsageChart";
import UsageTable, { fmt } from "./components/UsageTable";
import { FREE_PROVIDERS } from "@/shared/constants/providers";

const PERIODS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

// --- Main Page Component ---

export default function UsagePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 space-y-8 p-6 lg:p-10 pt-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Analytics Hub</h2>
            <p className="text-muted-foreground text-sm">
              Monitor your infrastructure usage and traffic metrics in real-time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodSelector />
          </div>
        </div>

        <Suspense fallback={<UsageLoadingState />}>
          <UsageContent />
        </Suspense>
      </main>
    </div>
  );
}

// --- Sub-components ---

function UsageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && ["overview", "details"].includes(tabFromUrl)
    ? tabFromUrl
    : "overview";

  const handleTabChange = (value) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/dashboard/usage?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="bg-muted/50 p-1 border border-border">
        <TabsTrigger value="overview" className="gap-2 px-4 py-1.5 rounded-md">
          <LayoutDashboard className="size-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider">Overview</span>
        </TabsTrigger>
        <TabsTrigger value="details" className="gap-2 px-4 py-1.5 rounded-md">
          <Terminal className="size-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider">Traffic Inspector</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
        <UsageDashboard />
      </TabsContent>

      <TabsContent value="details" className="animate-in fade-in duration-500">
        <RequestDetailsTab />
      </TabsContent>
    </Tabs>
  );
}

function PeriodSelector() {
  const [period, setPeriod] = useState("7d");
  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md border border-border">
       {PERIODS.map(p => (
         <Button
          key={p.value}
          variant={period === p.value ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all rounded-md", 
            period === p.value ? "bg-background border border-border/50 shadow-none" : "text-muted-foreground"
          )}
          onClick={() => {
            setPeriod(p.value);
            window.dispatchEvent(new CustomEvent("usage-period-change", { detail: p.value }));
          }}
         >
           {p.label}
         </Button>
       ))}
    </div>
  );
}

function UsageDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d");
  const [tableView, setTableView] = useState("model");
  const [viewMode, setViewMode] = useState("costs");
  const [providers, setProviders] = useState([]);

  const sortBy = searchParams.get("sortBy") || "rawModel";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const seen = new Set();
        const unique = (d?.connections || []).filter((c) => {
          if (seen.has(c.provider)) return false;
          seen.add(c.provider);
          return true;
        });
        const noAuthProviders = Object.values(FREE_PROVIDERS)
          .filter((p) => p.noAuth && !seen.has(p.id))
          .map((p) => ({ provider: p.id, name: p.name }));
        setProviders([...unique, ...noAuthProviders]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handlePeriodChange = (e) => setPeriod(e.detail);
    window.addEventListener("usage-period-change", handlePeriodChange);
    return () => window.removeEventListener("usage-period-change", handlePeriodChange);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/usage/stats?period=${period}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setStats((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    const es = new EventSource("/api/usage/stream");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setStats((prev) => ({
          ...(prev || {}),
          activeRequests: data.activeRequests,
          recentRequests: data.recentRequests,
          errorProvider: data.errorProvider,
          pending: data.pending,
        }));
      } catch (err) { console.error(err); }
    };
    return () => es.close();
  }, []);

  const toggleSort = useCallback((tableType, field) => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("sortBy") === field) {
      params.set("sortOrder", params.get("sortOrder") === "asc" ? "desc" : "asc");
    } else {
      params.set("sortBy", field);
      params.set("sortOrder", "asc");
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  if (loading && !stats) return <UsageLoadingState />;

  return (
    <div className="space-y-8">
      {/* 1. KPI Pulse Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPIItem label="Total Requests" value={fmt(stats?.requests)} icon={Zap} trend="+12.5%" />
        <KPIItem label="Est. Cost" value={`$${(stats?.cost || 0).toFixed(4)}`} icon={Database} trend="-2.1%" />
        <KPIItem label="Token Volume" value={fmt((stats?.promptTokens || 0) + (stats?.completionTokens || 0))} icon={Activity} />
        <KPIItem label="Active Streams" value={stats?.activeRequests?.length || 0} icon={Network} />
      </div>

      {/* 2. Live Operations Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Topology Card */}
        <Card className="lg:col-span-8 shadow-none border-border p-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-border bg-muted/20">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Network className="size-4 text-primary" />
                Infrastructure Flow
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground/60">Visualizing provider traffic routing</CardDescription>
            </div>
            <Badge variant="outline" className="h-5 px-2 bg-emerald-500/5 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
              LIVE PULSE
            </Badge>
          </CardHeader>
          <CardContent className="p-0 bg-muted/5 h-[400px]">
            <ProviderTopology
              providers={providers}
              activeRequests={stats?.activeRequests || []}
              lastProvider={stats?.recentRequests?.[0]?.provider || ""}
              errorProvider={stats?.errorProvider || ""}
            />
          </CardContent>
        </Card>

        {/* Live Feed Card */}
        <Card className="lg:col-span-4 shadow-none border-border overflow-hidden flex flex-col h-[482px] p-0">
          <CardHeader className="p-4 border-b border-border bg-muted/20">
             <CardTitle className="text-sm font-bold flex items-center gap-2">
               <History className="size-4 text-primary" />
               Recent Activity
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
             <RecentActivityList requests={stats?.recentRequests || []} />
          </CardContent>
          <CardFooter className="p-2 border-t border-border shrink-0 bg-muted/5">
             <Button variant="ghost" size="sm" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground group" render={
               <a href="/dashboard/usage?tab=details">
                 Traffic Inspector <ChevronRight className="ml-1 size-3 group-hover:translate-x-1 transition-transform" />
               </a>
             } />
          </CardFooter>
        </Card>
      </div>

      {/* 3. Deep Analysis Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/10 rounded-lg text-primary">
               <TrendingUp className="size-5" />
             </div>
             <div>
                <h3 className="text-xl font-bold tracking-tight">System Performance</h3>
                <p className="text-xs text-muted-foreground">Historical breakdown and dimensional analysis</p>
             </div>
          </div>
          
          <div className="flex items-center gap-1 bg-muted p-1 rounded-md border border-border">
            <Button 
              variant={viewMode === "costs" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest rounded-md"
              onClick={() => setViewMode("costs")}
            >
              Costs
            </Button>
            <Button 
              variant={viewMode === "tokens" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest rounded-md"
              onClick={() => setViewMode("tokens")}
            >
              Tokens
            </Button>
          </div>
        </div>

        <Card className="shadow-none border-border overflow-hidden p-0">
          <CardHeader className="p-4 border-b border-border bg-muted/20">
             <CardTitle className="text-sm font-bold flex items-center gap-2">
               <BarChart3 className="size-4 text-primary" />
               Performance Metrics
             </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-4">
            <UsageChart period={period} />
          </CardContent>
        </Card>

        <Tabs value={tableView} onValueChange={setTableView} className="space-y-4">
          <TabsList className="bg-transparent h-auto p-0 gap-2 border-none">
            {[
              { value: "model", label: "Model", icon: Cpu },
              { value: "account", label: "Account", icon: ShieldCheck },
              { value: "apiKey", label: "Credential", icon: Key },
              { value: "endpoint", label: "Endpoint", icon: Server },
            ].map(tab => (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="h-8 px-4 rounded-md border border-transparent data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-none text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                <tab.icon className="size-3 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <Card className="shadow-none border-border overflow-hidden p-0">
            <CardContent className="p-0">
              <UsageTableContainer 
                stats={stats} 
                tableView={tableView} 
                sortBy={sortBy} 
                sortOrder={sortOrder} 
                toggleSort={toggleSort}
                viewMode={viewMode}
              />
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}

// --- Helper Components ---

function KPIItem({ label, value, icon: Icon, trend }) {
  return (
    <Card className="shadow-none border-border bg-card p-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground opacity-50" />
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        {trend && (
          <p className={cn(
            "text-[10px] font-bold mt-1",
            trend.startsWith("+") ? "text-emerald-500" : "text-amber-500"
          )}>
            {trend} <span className="text-muted-foreground font-medium ml-1 opacity-70">vs last period</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityList({ requests = [] }) {
  if (!requests.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center opacity-30">
         <Activity className="size-10 mb-2" />
         <p className="text-xs font-bold uppercase tracking-widest">Awaiting traffic...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y border-t border-border">
        {requests.map((r, i) => {
          const ok = !r.status || r.status === "ok" || r.status === "success";
          return (
            <div key={i} className="p-4 hover:bg-muted/30 transition-all flex items-start gap-4">
              <div className={cn(
                "size-1.5 rounded-full mt-2 shrink-0 animate-pulse", 
                ok ? "bg-emerald-500" : "bg-red-500"
              )} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate pr-2">{r.model}</span>
                  <span className="text-[10px] font-medium text-muted-foreground shrink-0 tabular-nums">
                    <TimeAgo timestamp={r.timestamp} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[9px] font-bold border-border bg-muted/50 px-1 h-3.5 uppercase">
                    {r.provider}
                  </Badge>
                  <div className="flex items-center gap-2 text-[10px] font-bold tabular-nums text-muted-foreground">
                    <div className="flex items-center gap-0.5">
                       <ArrowUp className="size-2.5 opacity-50" />
                       {fmt(r.promptTokens)}
                    </div>
                    <div className="flex items-center gap-0.5">
                       <ArrowDown className="size-2.5 opacity-50" />
                       {fmt(r.completionTokens)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function UsageTableContainer({ stats, tableView, sortBy, sortOrder, toggleSort, viewMode }) {
  const config = useMemo(() => {
    if (!stats) return null;
    
    const sortData = (dataMap, pendingMap = {}, sBy, sOrder) => {
      return Object.entries(dataMap || {})
        .map(([key, data]) => ({ 
          ...data, 
          key, 
          totalTokens: (data.promptTokens || 0) + (data.completionTokens || 0),
          pending: pendingMap[key] || 0 
        }))
        .sort((a, b) => {
          let valA = a[sBy];
          let valB = b[sBy];
          if (typeof valA === "string") valA = valA.toLowerCase();
          if (typeof valB === "string") valB = valB.toLowerCase();
          return valA < valB ? (sOrder === "asc" ? -1 : 1) : (sOrder === "asc" ? 1 : -1);
        });
    };

    const groupDataByKey = (data, keyField) => {
      const groups = {};
      data.forEach(item => {
        const gk = item[keyField] || item.rawModel || "Unknown";
        if (!groups[gk]) groups[gk] = { groupKey: gk, summary: { requests: 0, lastUsed: null }, items: [] };
        groups[gk].summary.requests += item.requests || 0;
        if (item.lastUsed && (!groups[gk].summary.lastUsed || new Date(item.lastUsed) > new Date(groups[gk].summary.lastUsed))) {
          groups[gk].summary.lastUsed = item.lastUsed;
        }
        groups[gk].items.push(item);
      });
      return Object.values(groups);
    };

    const COLUMNS = {
      model: [{ field: "rawModel", label: "Model" }, { field: "provider", label: "Provider" }, { field: "requests", label: "Requests", align: "right" }, { field: "lastUsed", label: "Activity", align: "right" }],
      account: [{ field: "accountName", label: "Account" }, { field: "rawModel", label: "Last Model" }, { field: "requests", label: "Requests", align: "right" }, { field: "lastUsed", label: "Activity", align: "right" }],
      apiKey: [{ field: "keyName", label: "Key" }, { field: "rawModel", label: "Last Model" }, { field: "requests", label: "Requests", align: "right" }, { field: "lastUsed", label: "Activity", align: "right" }],
      endpoint: [{ field: "endpoint", label: "Endpoint" }, { field: "rawModel", label: "Last Model" }, { field: "requests", label: "Requests", align: "right" }, { field: "lastUsed", label: "Activity", align: "right" }]
    };

    const viewToField = { model: "rawModel", account: "accountName", apiKey: "keyName", endpoint: "endpoint" };
    const rawData = stats[tableView === "apiKey" ? "byApiKey" : tableView === "account" ? "byAccount" : tableView === "endpoint" ? "byEndpoint" : "byModel"] || {};
    const pendingMap = stats.pending?.[tableView === "model" ? "byModel" : "byAccount"] || {};

    return {
      columns: COLUMNS[tableView] || COLUMNS.model,
      groupedData: groupDataByKey(sortData(rawData, pendingMap, sortBy, sortOrder), viewToField[tableView] || "rawModel"),
      storageKey: `usage-v2-expanded:${tableView}`
    };
  }, [stats, tableView, sortBy, sortOrder]);

  if (!config) return null;

  return (
    <UsageTable
      title=""
      columns={config.columns}
      groupedData={config.groupedData}
      tableType={tableView}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onToggleSort={toggleSort}
      viewMode={viewMode}
      storageKey={config.storageKey}
      emptyMessage="No data records found for this scope."
      renderSummaryCells={(group) => (
        <>
          <td className="px-4 py-3 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">—</td>
          <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(group.summary.requests)}</td>
          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums text-[10px] font-bold uppercase">
            {group.summary.lastUsed ? timeAgo(group.summary.lastUsed) : "Never"}
          </td>
        </>
      )}
      renderDetailCells={(item) => (
        <>
          <td className="px-4 py-3">
             <div className="flex flex-col">
                <span className="font-bold text-xs tracking-tight">{item[tableView === "apiKey" ? "keyName" : tableView === "account" ? "accountName" : tableView === "endpoint" ? "endpoint" : "rawModel"] || "Unknown"}</span>
                {tableView !== "model" && <span className="text-[10px] font-medium text-muted-foreground/60">{item.rawModel}</span>}
             </div>
          </td>
          <td className="px-4 py-3">
            <Badge variant="outline" className="text-[9px] font-bold border-border bg-muted/50 px-1.5 h-4 uppercase">
              {item.provider}
            </Badge>
          </td>
          <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(item.requests)}</td>
          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums text-[10px] font-bold uppercase">
            {item.lastUsed ? timeAgo(item.lastUsed) : "—"}
          </td>
        </>
      )}
    />
  );
}

// --- Utilities ---

function timeAgo(timestamp) {
  if (!timestamp) return "Never";
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function TimeAgo({ timestamp }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);
  return <span>{timeAgo(timestamp)} ago</span>;
}

function UsageLoadingState() {
  return (
    <div className="space-y-8 animate-pulse p-6 lg:p-10 pt-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-12 h-[400px]">
         <Skeleton className="lg:col-span-8 rounded-lg" />
         <Skeleton className="lg:col-span-4 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
