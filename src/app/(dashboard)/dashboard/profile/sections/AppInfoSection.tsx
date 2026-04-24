import { APP_CONFIG } from "@/shared/constants/config";

export function AppInfoSection() {
  return (
    <div className="text-center text-sm text-muted-foreground py-4">
      <p>{APP_CONFIG.name} v{APP_CONFIG.version}</p>
      <p className="mt-1">Local Mode - All data stored on your machine</p>
    </div>
  );
}
