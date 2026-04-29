"use client";

import React, { useState, useEffect, useRef } from "react";
import { Desktop, LightningIcon, Trash } from "@phosphor-icons/react";
import { translate } from "@/i18n/runtime";
import { Card, Button } from "@/shared/components";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config";

const LOG_LEVEL_COLORS: Record<string, string> = {
  LOG: "text-zinc-100",
  INFO: "text-sky-300",
  WARN: "text-amber-300",
  ERROR: "text-rose-300",
  DEBUG: "text-violet-300",
};

function colorLine(line: string) {
  const match = line.match(/\[(\w+)\]/g);
  const levelTag = match ? match[0]?.replace(/[\[\]]/g, "") : null;
  const color = LOG_LEVEL_COLORS[levelTag || ""] || "text-zinc-100";
  return <span className={color}>{line}</span>;
}

export default function ConsoleLogClient() {
  const [logs, setLogs] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [connected, setConnected] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const handleClear = async () => {
    try {
      await fetch("/api/translator/console-logs", { method: "DELETE" });
    } catch (err) {
      console.error("Failed to clear console logs:", err);
    }
  };

  useEffect(() => {
    const es = new EventSource("/api/translator/console-logs/stream");
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "init") {
        setLogs(msg.logs.slice(-CONSOLE_LOG_CONFIG.maxLines));
      } else if (msg.type === "line") {
        setLogs((prev) => {
          const next = [...prev, msg.line];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
      } else if (msg.type === "clear") {
        setLogs([]);
      }
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 py-6 px-4">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LightningIcon className="size-4" weight="bold" />
            {translate("Core Services")}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("Console Log")}</h1>
          <p className="text-sm text-muted-foreground">
            {translate("Live server infrastructure telemetry stream.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleClear} className="h-8 text-xs px-3">
            <Trash className="size-3.5 mr-2" weight="bold" />
            {translate("Clear Stream")}
          </Button>
        </div>
      </header>

      <Card className="border-border/50 overflow-hidden bg-black shadow-none">
        <div
          ref={logRef}
          className="p-4 text-xs font-mono tabular-nums h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar bg-black/40 shadow-inner"
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Desktop className="size-10 text-muted-foreground/50" weight="bold" />
              <span className="text-xs text-muted-foreground">{translate("Awaiting telemetry...")}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all border-l-2 border-zinc-700 pl-3 py-0.5 text-xs hover:bg-white/5 transition-colors">{colorLine(line)}</div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
