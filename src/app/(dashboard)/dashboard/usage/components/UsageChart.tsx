"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { translate } from "@/i18n/runtime";
import { getUsageChartXAxisInterval } from "./usageChartConfig";

const fmtTokens = (n: number) => {
 if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
 if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
 return String(n || 0);
};

const fmtCost = (n: number) => `$${(n || 0).toFixed(4)}`;

const fmtCostAxis = (n: number) => {
 if (!n) return "$0";
 if (n >= 1) return `$${n.toFixed(2)}`;
 if (n >= 0.01) return `$${n.toFixed(3)}`;
 return `$${n.toPrecision(2)}`;
};

interface ChartData {
  label: string;
  tokens: number;
  cost: number;
}

interface UsageChartProps {
  period?: string;
  viewMode?: "tokens" | "cost";
}

export default function UsageChart({ period = "7d", viewMode = "tokens" }: UsageChartProps) {
 const [data, setData] = useState<ChartData[]>([]);
 const [loading, setLoading] = useState(true);

 const fetchData = useCallback(async () => {
 setLoading(true);
 try {
 const res = await fetch(`/api/usage/chart?period=${period}`);
 if (res.ok) {
 const json = await res.json();
 setData(json);
 }
 } catch (e) {
 console.error("Failed to fetch chart data:", e);
 } finally {
 setLoading(false);
 }
 }, [period]);

 useEffect(() => {
 queueMicrotask(() => { void fetchData(); });
 }, [fetchData]);

 const hasData = data.some((d) => d.tokens > 0 || d.cost > 0);

 return (
 <div className="pt-2">
 {loading ? (
 <div className="h-48 flex items-center justify-center text-muted-foreground text-xs animate-pulse">
 {translate("Loading metrics...")}
 </div>
 ) : !hasData ? (
 <div className="h-48 flex items-center justify-center text-muted-foreground text-xs opacity-70">
 {translate("No data available for this period")}
 </div>
 ) : (
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
 <XAxis
 dataKey="label"
 tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
 tickLine={false}
 axisLine={false}
 interval={getUsageChartXAxisInterval(data.length)}
 />
 <YAxis
 width={44}
 tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
 tickLine={false}
 axisLine={false}
 tickFormatter={viewMode === "tokens" ? fmtTokens : fmtCostAxis}
 />
 <Tooltip
 cursor={{ fill: "transparent" }}
 contentStyle={{
 backgroundColor: "hsl(var(--background))",
 border: "1px solid hsl(var(--border))",
 borderRadius: "0.375rem",
 fontSize: "11px",
 fontWeight: 500,
 boxShadow: "none",
 }}
 itemStyle={{ padding: "0" }}
 formatter={(value: any) =>
 viewMode === "tokens" ? [fmtTokens(value as number), "Tokens"] : [fmtCost(value as number), "Cost"]
 }
 />
 <Bar
 dataKey={viewMode === "tokens" ? "tokens" : "cost"}
 fill={viewMode === "tokens" ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
 activeBar={{ fillOpacity: 0.82, stroke: "none" }}
 radius={[2, 2, 0, 0]}
 maxBarSize={20}
 />
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>
 );
}
