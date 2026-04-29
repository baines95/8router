import { DesktopIcon, SunIcon, MoonIcon, CircleHalfIcon, DownloadIcon, UploadIcon } from "@phosphor-icons/react";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button, Card, CardHeader, CardTitle, Input } from "@/shared/components";
import { translate } from "@/i18n/runtime";
import { cn } from "@/lib/utils";

interface Props {
  machineId: string;
  theme: string;
  setTheme: (value: string) => void;
  dbLoading: boolean;
  importFileRef: React.RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function LocalModeSection({ machineId, theme, setTheme, dbLoading, importFileRef, onExport, onImport }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DesktopIcon className="size-4" weight="bold" />
          {translate("Local")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="machine-id">{translate("Machine ID")}</Label>
          <Input id="machine-id" value={machineId} readOnly className="h-9 font-mono text-xs tabular-nums" />
        </div>

        <div className="space-y-2">
          <Label>{translate("Theme")}</Label>
          <div className="inline-flex w-full flex-wrap gap-2 border p-2 sm:w-auto">
            {["light", "dark", "system"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                  theme === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "light" && <SunIcon className="size-4" weight={theme === option ? "fill" : "bold"} />}
                {option === "dark" && <MoonIcon className="size-4" weight={theme === option ? "fill" : "bold"} />}
                {option === "system" && <CircleHalfIcon className="size-4" weight={theme === option ? "fill" : "bold"} />}
                <span className="capitalize">{translate(option)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{translate("Database Location")}</Label>
          <Input value="~/.8router/db.json" readOnly className="h-9 font-mono text-xs tabular-nums" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={onExport} disabled={dbLoading} className="h-8 text-xs w-full sm:w-auto">
            <DownloadIcon className="mr-2 size-4" weight="bold" />
            {translate("Download Backup")}
          </Button>
          <Button variant="outline" onClick={() => importFileRef.current?.click()} disabled={dbLoading} className="h-8 text-xs w-full sm:w-auto">
            <UploadIcon className="mr-2 size-4" weight="bold" />
            {translate("Import Backup")}
          </Button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        </div>

        <p className="text-xs text-muted-foreground">{translate("Running on your machine with local storage.")}</p>
      </CardContent>
    </Card>
  );
}
