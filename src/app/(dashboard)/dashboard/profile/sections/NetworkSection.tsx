import { WifiHighIcon } from "@phosphor-icons/react";
import { Button, Card, Input, Toggle } from "@/shared/components";
import { cn } from "@/lib/utils";
import type { Settings, Status } from "./types";

interface Props {
  settings: Settings;
  proxyForm: { outboundProxyEnabled: boolean; outboundProxyUrl: string; outboundNoProxy: string };
  setProxyForm: (value: { outboundProxyEnabled: boolean; outboundProxyUrl: string; outboundNoProxy: string } | ((prev: { outboundProxyEnabled: boolean; outboundProxyUrl: string; outboundNoProxy: string }) => { outboundProxyEnabled: boolean; outboundProxyUrl: string; outboundNoProxy: string })) => void;
  proxyStatus: Status;
  proxyLoading: boolean;
  proxyTestLoading: boolean;
  onToggleProxy: () => void;
  onSubmitProxy: (e: React.FormEvent) => void;
  onTestProxy: () => void;
}

export function NetworkSection({ settings, proxyForm, setProxyForm, proxyStatus, proxyLoading, proxyTestLoading, onToggleProxy, onSubmitProxy, onTestProxy }: Props) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 text-primary"><WifiHighIcon className="size-5" weight="bold" /></div>
        <h3 className="text-lg font-semibold">Network</h3>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Outbound Proxy</p>
            <p className="text-sm text-muted-foreground">Enable proxy for OAuth + provider outbound requests.</p>
          </div>
          <Toggle checked={settings.outboundProxyEnabled === true} onCheckedChange={onToggleProxy} />
        </div>

        {settings.outboundProxyEnabled === true && (
          <form onSubmit={onSubmitProxy} className="flex flex-col gap-4 pt-2 border-t border-border/50">
            <div className="flex flex-col gap-2">
              <label className="font-medium">Proxy URL</label>
              <Input placeholder="http://127.0.0.1:7897" value={proxyForm.outboundProxyUrl} onChange={(e) => setProxyForm((prev) => ({ ...prev, outboundProxyUrl: e.target.value }))} />
              <p className="text-sm text-muted-foreground">Leave empty to inherit existing env proxy (if any).</p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <label className="font-medium">No Proxy</label>
              <Input placeholder="localhost,127.0.0.1" value={proxyForm.outboundNoProxy} onChange={(e) => setProxyForm((prev) => ({ ...prev, outboundNoProxy: e.target.value }))} />
              <p className="text-sm text-muted-foreground">Comma-separated hostnames/domains to bypass the proxy.</p>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-center gap-2">
              <Button type="button" variant="secondary" disabled={proxyTestLoading} onClick={onTestProxy}>
                {proxyTestLoading ? "Testing..." : "Test proxy URL"}
              </Button>
              <Button type="submit" disabled={proxyLoading}>{proxyLoading ? "Applying..." : "Apply"}</Button>
            </div>
          </form>
        )}

        {proxyStatus.message && <p className={cn("text-sm pt-2 border-t border-border/50", proxyStatus.type === "error" ? "text-destructive" : "text-primary")}>{proxyStatus.message}</p>}
      </div>
    </Card>
  );
}
