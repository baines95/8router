"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChartLineUpIcon as Pulse,
  LightningIcon as Zap,
  GraphIcon as Network,
  ArrowUpIcon,
  ArrowDownIcon,
  DatabaseIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SettingsPageShell } from "../_settings/components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
 Card, 
 CardContent, 
 CardHeader, 
 CardTitle, 
 CardFooter,
 CardAction,
 CardDescription
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import { translate } from "@/i18n/runtime";
import RequestDetailsTab from "./components/RequestDetailsTab";
import ProviderTopology from "./components/ProviderTopology";
import UsageChart from "./components/UsageChart";
import UsageTable, { fmt } from "./components/UsageTable";
import { FREE_PROVIDERS } from "@/shared/constants/providers";
import { usageTimeAgoTicker } from "./components/liveTicker";
import { defaultStats, mergeLiveStats } from "./components/liveStats";

const PERIODS = [
 { value: "24h", label: "24h" },
 { value: "7d", label: "7d" },
 { value: "30d", label: "30d" },
 { value: "60d", label: "60d" },
];

interface ActiveRequest {
  model: string;
  provider: string;
  account: string;
  count: number;
}

interface RecentRequest {
  timestamp: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  status?: string;
}

type UsageRow = Record<string, unknown> & {
  requests?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  cost?: number;
  lastUsed?: string;
  rawModel?: string;
  provider?: string;
  accountName?: string;
  keyName?: string;
  endpoint?: string;
};

type UsageMap = Record<string, UsageRow>;
type PendingMap = Record<string, number>;

interface Stats {
  totalRequests: number;
  totalCost: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  activeRequests: ActiveRequest[];
  recentRequests: RecentRequest[];
  errorProvider: string;
  pending?: {
    byModel?: PendingMap;
    byAccount?: PendingMap;
  };
  byModel?: UsageMap;
  byAccount?: UsageMap;
  byApiKey?: UsageMap;
  byEndpoint?: UsageMap;
}

interface ProviderConnection {
  provider: string;
  name?: string;
}

interface ProvidersApiResponse {
  connections?: ProviderConnection[];
}

interface FreeProviderConfig {
  id: string;
  name: string;
  noAuth?: boolean;
}

interface SwitchTabDetail {
  detail: string;
}

interface PeriodChangeDetail {
  detail: string;
}

interface LiveStatsData {
  activeRequests?: ActiveRequest[];
  recentRequests?: RecentRequest[];
  errorProvider?: string;
  pending?: Stats["pending"];
}

const TABLE_VIEW_FIELD_MAP = {
  model: "rawModel",
  account: "accountName",
  apiKey: "keyName",
  endpoint: "endpoint",
} as const;

const TABLE_VIEW_DATA_KEY_MAP = {
  model: "byModel",
  account: "byAccount",
  apiKey: "byApiKey",
  endpoint: "byEndpoint",
} as const;

type TableView = keyof typeof TABLE_VIEW_FIELD_MAP;

interface GroupedUsageData {
  groupKey: string;
  summary: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    inputCost: number;
    outputCost: number;
    lastUsed: string | null;
    pending?: number;
  };
  items: (UsageRow & { key: string; totalTokens: number; pending: number })[];
}

interface UsageColumn {
  field: string;
  label: string;
  align?: "right";
}

interface UsageTableConfig {
  columns: UsageColumn[];
  groupedData: GroupedUsageData[];
  storageKey: string;
}

const DEFAULT_STATS: Stats = defaultStats<Stats>();

export default function UsagePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && ["overview", "network", "details"].includes(tabFromUrl)
    ? tabFromUrl
    : "overview";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/dashboard/usage?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const handleSwitchTab = (event: Event) => {
      const customEvent = event as CustomEvent<SwitchTabDetail["detail"]>;
      handleTabChange(customEvent.detail);
    };
    window.addEventListener("switch-tab", handleSwitchTab);
    return () => window.removeEventListener("switch-tab", handleSwitchTab);
  }, [searchParams, router]);

  return (
    <SettingsPageShell className="max-w-7xl w-full p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{translate("Usage")}</h1>
          <p className="text-sm text-muted-foreground">
            {translate("Monitor infrastructure usage and traffic in real-time.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col gap-6">
        <TabsList className="w-full justify-start border-b border-border/40 rounded-none h-auto p-0 bg-transparent gap-6">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 text-sm font-medium data-[state=active]:shadow-none -mb-px">
            {translate("Overview")}
          </TabsTrigger>
          <TabsTrigger value="network" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 text-sm font-medium data-[state=active]:shadow-none -mb-px">
            {translate("Network Topology")}
          </TabsTrigger>
          <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 text-sm font-medium data-[state=active]:shadow-none -mb-px">
            {translate("Traffic Inspector")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="outline-none">
          <Suspense fallback={<UsageLoadingState />}>
            <UsageDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="network" className="outline-none">
          <Suspense fallback={<UsageLoadingState />}>
            <NetworkDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="details" className="outline-none">
          <RequestDetailsTab />
        </TabsContent>
      </Tabs>
    </SettingsPageShell>
  );
}

function PeriodSelector() {
  const [period, setPeriod] = useState("7d");
  return (
    <div className="flex items-center gap-1 bg-muted/30 p-1 border rounded-md">
      {PERIODS.map(p => (
        <Button
          key={p.value}
          variant={period === p.value ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-7 px-3 text-xs font-medium transition-all", 
            period === p.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
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

function NetworkDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => (r.ok ? (r.json() as Promise<ProvidersApiResponse>) : null))
      .then((data) => {
        const seen = new Set<string>();
        const unique = (data?.connections || []).filter((connection) => {
          if (seen.has(connection.provider)) return false;
          seen.add(connection.provider);
          return true;
        });
        const noAuthProviders = Object.values(FREE_PROVIDERS)
          .filter((provider) => {
            const freeProvider = provider as FreeProviderConfig;
            return freeProvider.noAuth && !seen.has(freeProvider.id);
          })
          .map((provider) => {
            const freeProvider = provider as FreeProviderConfig;
            return { provider: freeProvider.id, name: freeProvider.name };
          });
        setProviders([...unique, ...noAuthProviders]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/usage/stream");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveStatsData;
        setStats((prev) => {
          const base = prev || DEFAULT_STATS;
          return mergeLiveStats(base, data);
        });
      } catch (error) {
        console.error(error);
      }
    };
    return () => es.close();
  }, []);


  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" />
          {translate("Infrastructure Topology")}
        </CardTitle>
        <CardDescription>{translate("Real-time map of your API traffic flow.")}</CardDescription>
        <CardAction>
          <Badge variant="outline" className="text-primary border-primary/20">
            {translate("Live")}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 bg-muted/5 border-t">
        <ProviderTopology
          providers={providers}
          activeRequests={stats?.activeRequests || []}
          lastProvider={stats?.recentRequests?.[0]?.provider || ""}
          errorProvider={stats?.errorProvider || ""}
        />
      </CardContent>
    </Card>
  );
}

function UsageDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d");
  const [tableView, setTableView] = useState<TableView>("model");
  const [viewMode, setViewMode] = useState<"cost" | "tokens">("cost");

  const sortBy = searchParams.get("sortBy") || "rawModel";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "asc";

  useEffect(() => {
    const handlePeriodChange = (event: Event) => {
      const customEvent = event as CustomEvent<PeriodChangeDetail["detail"]>;
      setPeriod(customEvent.detail);
    };
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
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveStatsData;
        setStats((prev) => {
          const base = prev || DEFAULT_STATS;
          return mergeLiveStats(base, data);
        });
      } catch (error) {
        console.error(error);
      }
    };
    return () => es.close();
  }, []);

  const toggleSort = useCallback((field: string) => {
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
    <div className="flex flex-col gap-6">
      {/* 1. KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPIItem label="Requests" value={fmt(stats?.totalRequests ?? 0)} icon={Zap} />
        <KPIItem label="Estimated Cost" value={`$${(stats?.totalCost || 0).toFixed(4)}`} icon={DatabaseIcon} />
        <KPIItem label="Token Volume" value={fmt((stats?.totalPromptTokens || 0) + (stats?.totalCompletionTokens || 0))} icon={Pulse} />
        <KPIItem label="Active Streams" value={stats?.activeRequests?.length || 0} icon={Network} />
      </div>

      {/* 2. Main Chart & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{translate("Performance")}</CardTitle>
            <CardDescription>{translate("Traffic and cost metrics over time.")}</CardDescription>
            <CardAction>
              <div className="flex items-center gap-1">
                <Button 
                  variant={viewMode === "cost" ? "secondary" : "ghost"} 
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setViewMode("cost")}
                >
                  {translate("Costs")}
                </Button>
                <Button 
                  variant={viewMode === "tokens" ? "secondary" : "ghost"} 
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setViewMode("tokens")}
                >
                  {translate("Tokens")}
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <UsageChart period={period} viewMode={viewMode} />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{translate("Recent Activity")}</CardTitle>
            <CardDescription>{translate("Latest API requests.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 px-4 pb-4">
            <RecentPulseList requests={stats?.recentRequests || []} />
          </CardContent>
          <CardFooter className="pt-4 border-t mt-auto">
            <Button variant="outline" className="w-full text-xs" onClick={() => window.dispatchEvent(new CustomEvent("switch-tab", { detail: "details" }))}>
              {translate("View All Logs")}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* 3. Dimensions Table */}
      <Card>
        <CardHeader className="border-b pb-0 px-0">
          <Tabs value={tableView} onValueChange={setTableView} className="w-full">
            <div className="flex items-center justify-between px-6">
              <div className="flex flex-col gap-1 py-4">
                <CardTitle className="text-sm font-medium">{translate("Usage Details")}</CardTitle>
                <CardDescription>{translate("Breakdown by dimensions.")}</CardDescription>
              </div>
              <TabsList className="bg-transparent h-auto p-0 gap-6">
                {[
                  { value: "model", label: "Model" },
                  { value: "account", label: "Account" },
                  { value: "apiKey", label: "Credential" },
                  { value: "endpoint", label: "Endpoint" },
                ].map(tab => (
                  <TabsTrigger 
                    key={tab.value} 
                    value={tab.value} 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-4 text-sm font-medium data-[state=active]:shadow-none -mb-[1px]"
                  >
                    {translate(tab.label)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </CardHeader>
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
    </div>
  );
}

function KPIItem({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {translate(label)}
        </CardTitle>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function RecentPulseList({ requests = [] }: { requests: RecentRequest[] }) {
  if (!requests.length) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-muted-foreground">
        <Pulse className="size-8 mb-2 opacity-20" />
        <p className="text-sm">{translate("No recent activity")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[250px]">
      <div className="flex flex-col">
        {requests.map((r, i) => {
          const ok = !r.status || r.status === "ok" || r.status === "success";
          return (
            <div key={i} className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0 hover:bg-muted/50 transition-colors">
              <div className={cn(
                "size-2 rounded-full mt-1.5 shrink-0", 
                ok ? "bg-primary" : "bg-destructive"
              )} />
              <div className="flex flex-col gap-1 w-full min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{r.model}</span>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    <TimeAgo timestamp={r.timestamp} />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-xs font-normal px-1.5">
                    {r.provider}
                  </Badge>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                    <div className="flex items-center gap-1">
                      <ArrowUpIcon className="size-3" />
                      {fmt(r.promptTokens)}
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowDownIcon className="size-3" />
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

function UsageTableContainer({ stats, tableView, sortBy, sortOrder, toggleSort, viewMode }: {
  stats: Stats | null,
  tableView: TableView,
  sortBy: string,
  sortOrder: "asc" | "desc",
  toggleSort: (field: string) => void,
  viewMode: "cost" | "tokens"
}) {
  const config = useMemo<UsageTableConfig | null>(() => {
    if (!stats) return null;

    const sortData = (dataMap: UsageMap, pendingMap: PendingMap, sBy: string, sOrder: "asc" | "desc") => {
      return Object.entries(dataMap || {})
        .map(([key, data]) => ({
          ...data,
          key,
          totalTokens: Number(data.totalTokens || 0) || (Number(data.promptTokens || 0) + Number(data.completionTokens || 0)),
          pending: Number(pendingMap[key] || 0),
        }))
        .sort((a, b) => {
          const rawA = a[sBy as keyof typeof a];
          const rawB = b[sBy as keyof typeof b];
          const valA = typeof rawA === "string" ? rawA.toLowerCase() : Number(rawA ?? 0);
          const valB = typeof rawB === "string" ? rawB.toLowerCase() : Number(rawB ?? 0);
          return valA < valB ? (sOrder === "asc" ? -1 : 1) : (sOrder === "asc" ? 1 : -1);
        });
    };

    const groupDataByKey = (data: (UsageRow & { key: string; totalTokens: number; pending: number })[], keyField: string): GroupedUsageData[] => {
      const groups: Record<string, GroupedUsageData> = {};
      data.forEach((item) => {
        const gk = String(item[keyField as keyof UsageRow] || item.rawModel || "Unknown");
        if (!groups[gk]) {
          groups[gk] = {
            groupKey: gk,
            summary: {
              requests: 0,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cost: 0,
              inputCost: 0,
              outputCost: 0,
              lastUsed: null,
            },
            items: [],
          };
        }

        groups[gk].summary.requests += Number(item.requests || 0);
        groups[gk].summary.promptTokens += Number(item.promptTokens || 0);
        groups[gk].summary.completionTokens += Number(item.completionTokens || 0);
        groups[gk].summary.totalTokens += Number(item.totalTokens || 0);
        groups[gk].summary.cost += Number(item.cost || item.totalCost || 0);
        groups[gk].summary.inputCost += Number(item.inputCost || 0);
        groups[gk].summary.outputCost += Number(item.outputCost || 0);

        if (item.lastUsed && (!groups[gk].summary.lastUsed || new Date(item.lastUsed) > new Date(groups[gk].summary.lastUsed))) {
          groups[gk].summary.lastUsed = item.lastUsed;
        }
        groups[gk].items.push(item);
      });
      return Object.values(groups);
    };

    const COLUMNS: Record<TableView, UsageColumn[]> = {
      model: [{ field: "rawModel", label: "Model" }, { field: "provider", label: "Provider" }, { field: "requests", label: "Requests", align: "right" } as UsageColumn, { field: "lastUsed", label: "Pulse", align: "right" } as UsageColumn],
      account: [{ field: "accountName", label: "Account" }, { field: "rawModel", label: "Last Model" }, { field: "requests", label: "Requests", align: "right" } as UsageColumn, { field: "lastUsed", label: "Pulse", align: "right" } as UsageColumn],
      apiKey: [{ field: "keyName", label: "Key" }, { field: "rawModel", label: "Last Model" }, { field: "requests", label: "Requests", align: "right" } as UsageColumn, { field: "lastUsed", label: "Pulse", align: "right" } as UsageColumn],
      endpoint: [{ field: "endpoint", label: "Endpoint" }, { field: "rawModel", label: "Last Model" }, { field: "requests", label: "Requests", align: "right" } as UsageColumn, { field: "lastUsed", label: "Pulse", align: "right" } as UsageColumn],
    };

    const dataKey = TABLE_VIEW_DATA_KEY_MAP[tableView];
    const fieldKey = TABLE_VIEW_FIELD_MAP[tableView];
    const rawData = (stats[dataKey] || {}) as UsageMap;
    const pendingMap = (stats.pending?.[tableView === "model" ? "byModel" : "byAccount"] || {}) as PendingMap;

    return {
      columns: COLUMNS[tableView],
      groupedData: groupDataByKey(sortData(rawData, pendingMap, sortBy, sortOrder), fieldKey),
      storageKey: `usage-v2-expanded:${tableView}`,
    };
  }, [stats, tableView, sortBy, sortOrder]);

  if (!config) return null;

  return (
    <UsageTable
      columns={config.columns}
      groupedData={config.groupedData}
      tableType={tableView}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onToggleSort={toggleSort}
      viewMode={viewMode === "cost" ? "cost" : "tokens"}
      storageKey={config.storageKey}
      emptyMessage={translate("No data records found for this scope.")}
      renderSummaryCells={(group) => (
        <>
          <td className="px-4 py-3 text-muted-foreground text-xs font-medium">—</td>
          <td className="px-4 py-3 text-right font-medium tabular-nums text-sm text-foreground">{fmt(group.summary.requests)}</td>
          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums text-xs font-medium">
            {group.summary.lastUsed ? timeAgo(group.summary.lastUsed) : translate("Never")}
          </td>
        </>
      )}
      renderDetailCells={(item) => (
        <>
          <td className="px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{item[tableView === "apiKey" ? "keyName" : tableView === "account" ? "accountName" : tableView === "endpoint" ? "endpoint" : "rawModel"] || "Unknown"}</span>
              {tableView !== "model" && <span className="text-xs text-muted-foreground">{item.rawModel}</span>}
            </div>
          </td>
          <td className="px-4 py-3">
            <Badge variant="secondary" className="text-xs font-normal">
              {item.provider}
            </Badge>
          </td>
          <td className="px-4 py-3 text-right font-medium tabular-nums text-sm text-foreground">{fmt(item.requests)}</td>
          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums text-xs">
            {item.lastUsed ? timeAgo(item.lastUsed) : "—"}
          </td>
        </>
      )}
    />
  );
}

function timeAgo(timestamp: string) {
  if (!timestamp) return "Never";
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function TimeAgo({ timestamp }: { timestamp: string }) {
  const [, setTick] = useState(0);
  useEffect(() => usageTimeAgoTicker.subscribe(() => setTick((t) => t + 1)), []);
  return <span>{timeAgo(timestamp)}</span>;
}

function UsageLoadingState() {
  return (
    <div className="flex flex-col gap-6 animate-pulse mt-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-[100px] w-full rounded-md"/>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-[350px] rounded-md"/>
        <Skeleton className="h-[350px] rounded-md"/>
      </div>
    </div>
  );
}
