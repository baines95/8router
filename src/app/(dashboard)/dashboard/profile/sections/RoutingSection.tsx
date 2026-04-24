import { SignpostIcon } from "@phosphor-icons/react";
import { Card, Input, Toggle } from "@/shared/components";
import type { Settings } from "./types";

interface Props {
  settings: Settings;
  onFallbackToggle: () => void;
  onStickyChange: (value: string) => void;
  onComboToggle: () => void;
}

export function RoutingSection({ settings, onFallbackToggle, onStickyChange, onComboToggle }: Props) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 text-primary"><SignpostIcon className="size-5" weight="bold" /></div>
        <h3 className="text-lg font-semibold">Routing Strategy</h3>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Round Robin</p>
            <p className="text-sm text-muted-foreground">Cycle through accounts to distribute load</p>
          </div>
          <Toggle checked={settings.fallbackStrategy === "round-robin"} onCheckedChange={onFallbackToggle} />
        </div>

        {settings.fallbackStrategy === "round-robin" && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div>
              <p className="font-medium">Sticky Limit</p>
              <p className="text-sm text-muted-foreground">Calls per account before switching</p>
            </div>
            <Input type="number" min="1" max="10" value={settings.stickyRoundRobinLimit || 3} onChange={(e) => onStickyChange(e.target.value)} className="w-20 text-center" />
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div>
            <p className="font-medium">Combo Round Robin</p>
            <p className="text-sm text-muted-foreground">Cycle through providers in combos instead of always starting with first</p>
          </div>
          <Toggle checked={settings.comboStrategy === "round-robin"} onCheckedChange={onComboToggle} />
        </div>

        <p className="text-xs text-muted-foreground italic pt-2 border-t border-border/50">
          {settings.fallbackStrategy === "round-robin"
            ? `Currently distributing requests across all available accounts with ${settings.stickyRoundRobinLimit || 3} calls per account.`
            : "Currently using accounts in priority order (Fill First)."}
        </p>
      </div>
    </Card>
  );
}
