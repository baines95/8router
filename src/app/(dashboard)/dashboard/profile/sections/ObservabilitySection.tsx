import { PulseIcon } from "@phosphor-icons/react";
import { Card, Toggle } from "@/shared/components";

interface Props {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

export function ObservabilitySection({ enabled, onChange }: Props) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-muted/30 text-muted-foreground"><PulseIcon className="size-5" weight="bold" /></div>
        <h3 className="text-lg font-semibold">Observability</h3>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Enable Observability</p>
          <p className="text-sm text-muted-foreground">Record request details for inspection in the logs view</p>
        </div>
        <Toggle checked={enabled} onCheckedChange={onChange} />
      </div>
    </Card>
  );
}
