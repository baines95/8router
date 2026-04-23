"use client";

import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  RefreshCw, 
  Pulse, 
  Terminal,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function RequestLogger() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs(false);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/usage/request-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
           <Terminal className="size-4 text-primary" />
           <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Gateway Event Stream</h2>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-60">Auto-Stream</Label>
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} className="scale-75 data-[state=checked]:bg-emerald-500" />
        </div>
      </div>

      <Card className="shadow-none border-border overflow-hidden p-0 bg-muted/5">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px] leading-none whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Infrastructure Node</th>
                  <th className="px-4 py-3 text-center">Provider</th>
                  <th className="px-4 py-3">Credential Identity</th>
                  <th className="px-4 py-3 text-right">In</th>
                  <th className="px-4 py-3 text-right">Out</th>
                  <th className="px-4 py-3">Status Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading && logs.length === 0 ? (
                  <tr><td colSpan="7" className="p-12 text-center text-muted-foreground opacity-30 uppercase font-black tracking-widest animate-pulse">Syncing logs...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan="7" className="p-12 text-center text-muted-foreground opacity-30 uppercase font-black tracking-widest">Awaiting traffic events...</td></tr>
                ) : (
                  logs.map((log, i) => {
                    const parts = log.split(" | ");
                    if (parts.length < 7) return null;
                    const status = parts[6];
                    const isPending = status.includes("PENDING");
                    const isFailed = status.includes("FAILED");
                    const isSuccess = status.includes("OK");

                    return (
                      <tr key={i} className={cn("hover:bg-muted transition-colors", isPending && "bg-primary/5 animate-pulse")}>
                        <td className="px-4 py-2.5 text-muted-foreground opacity-60">{parts[0]}</td>
                        <td className="px-4 py-2.5 font-bold text-foreground">{parts[1]}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant="outline" className="h-4 text-[10px] font-black uppercase bg-muted/50 border-border text-muted-foreground">{parts[2]}</Badge>
                        </td>
                        <td className="px-4 py-2.5 truncate max-w-[180px] text-muted-foreground" title={parts[3]}>{parts[3]}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-primary opacity-80">{parts[4]}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-500 opacity-80">{parts[5]}</td>
                        <td className={cn("px-4 py-2.5 font-black uppercase tracking-tighter text-[10px]", isSuccess ? "text-emerald-500" : isFailed ? "text-destructive" : "text-primary")}>
                          {status}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-30">
        <Info className="size-2.5" /> Persistent storage: application_data/log.txt
      </div>
    </div>
  );
}
