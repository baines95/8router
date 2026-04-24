import { ShieldIcon } from "@phosphor-icons/react";
import { Button, Card, Input, Toggle } from "@/shared/components";
import { cn } from "@/lib/utils";
import type { Settings, Status } from "./types";

interface Props {
  settings: Settings;
  passwords: { current: string; new: string; confirm: string };
  setPasswords: (value: { current: string; new: string; confirm: string }) => void;
  passStatus: Status;
  passLoading: boolean;
  onRequireLoginChange: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function SecuritySection({ settings, passwords, setPasswords, passStatus, passLoading, onRequireLoginChange, onSubmit }: Props) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 text-primary"><ShieldIcon className="size-5" weight="bold" /></div>
        <h3 className="text-lg font-semibold">Security</h3>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Require login</p>
            <p className="text-sm text-muted-foreground">When ON, dashboard requires password. When OFF, access without login.</p>
          </div>
          <Toggle checked={settings.requireLogin === true} onCheckedChange={onRequireLoginChange} />
        </div>
        {settings.requireLogin === true && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-4 border-t border-border/50">
            {settings.hasPassword && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input type="password" placeholder="Enter current password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} required />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">New Password</label>
                <Input type="password" placeholder="Enter new password" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} required />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Confirm New Password</label>
                <Input type="password" placeholder="Confirm new password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required />
              </div>
            </div>
            {passStatus.message && <p className={cn("text-sm", passStatus.type === "error" ? "text-destructive" : "text-primary")}>{passStatus.message}</p>}
            <div className="pt-2">
              <Button type="submit" disabled={passLoading}>{passLoading ? "Updating..." : (settings.hasPassword ? "Update Password" : "Set Password")}</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
