"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { translate } from "@/i18n/runtime";

const chartConfig = {
  tokens: {
    label: "Tokens",
    color: "hsl(var(--primary))",
  },
  cost: {
    label: "Cost",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

const fmtTokens = (n: number) => {
 if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
 if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
 return String(n || 0);
};

const fmtCost = (n: number) => `$${(n || 0).toFixed(4)}`;

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
 fetchData();
 }, [fetchData]);

 const hasData = data.some((d) => d.tokens > 0 || d.cost > 0);

 if (loading) {
   return (
     <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground animate-pulse">
       {translate("Loading metrics...")}
     </div>
   );
 }

 if (!hasData) {
   return (
     <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
       {translate("No data available")}
     </div>
   );
 }

 return (
   <ChartContainer config={chartConfig} className="h-[250px] w-full">
     <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
       <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
       <XAxis
         dataKey="label"
         tickLine={false}
         tickMargin={10}
         axisLine={false}
         tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
       />
       <YAxis
         tickLine={false}
         axisLine={false}
         tickMargin={10}
         tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
         tickFormatter={viewMode === "tokens" ? fmtTokens : fmtCost}
       />
       <ChartTooltip 
         cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} 
         content={<ChartTooltipContent hideLabel indicator="dot" />} 
       />
       <Bar 
         dataKey={viewMode} 
         fill={`var(--color-${viewMode})`}
         radius={[2, 2, 0, 0]}
         maxBarSize={40}
       />
     </BarChart>
   </ChartContainer>
 );
}
