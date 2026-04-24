import { DesktopIcon, SunIcon, MoonIcon, CircleHalfIcon, DownloadIcon, UploadIcon } from "@phosphor-icons/react";
import { Button, Card } from "@/shared/components";
import { cn } from "@/lib/utils";
import type { Status } from "./types";

interface Props {
  machineId: string;
  theme: string;
  setTheme: (value: string) => void;
  dbLoading: boolean;
  dbStatus: Status;
  importFileRef: React.RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function LocalModeSection({ machineId, theme, setTheme, dbLoading, dbStatus, importFileRef, onExport, onImport }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <DesktopIcon className="size-6" weight="bold" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Local Mode</h2>
            <p className="text-muted-foreground">Running on your machine</p>
            <p className="text-xs font-mono opacity-50">ID: {machineId}</p>
          </div>
        </div>
        <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5">
          {["light", "dark", "system"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all",
                theme === option ? "bg-white dark:bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "light" && <SunIcon className="size-4.5" weight={theme === option ? "fill" : "bold"} />}
              {option === "dark" && <MoonIcon className="size-4.5" weight={theme === option ? "fill" : "bold"} />}
              {option === "system" && <CircleHalfIcon className="size-4.5" weight={theme === option ? "fill" : "bold"} />}
              <span className="capitalize text-sm">{option}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/5 border border-border/50">
          <div>
            <p className="font-medium">Database Location</p>
            <p className="text-sm text-muted-foreground font-mono">~/.8router/db.json</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onExport} disabled={dbLoading}>
            <DownloadIcon className="size-4 mr-2" weight="bold" />
            Download Backup
          </Button>
          <Button variant="outline" onClick={() => importFileRef.current?.click()} disabled={dbLoading}>
            <UploadIcon className="size-4 mr-2" weight="bold" />
            Import Backup
          </Button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        </div>
        {dbStatus.message && <p className={cn("text-sm", dbStatus.type === "error" ? "text-destructive" : "text-primary dark:text-primary")}>{dbStatus.message}</p>}
      </div>
    </Card>
  );
}
