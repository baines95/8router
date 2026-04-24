import type { ReactNode } from "react";

export function SettingsPageShell({ children, className = "max-w-2xl" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto ${className}`}>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
