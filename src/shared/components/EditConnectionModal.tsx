"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CheckCircle, 
  WarningCircle, 
  Pulse, 
  ShieldCheck, 
  FloppyDisk,
  Power
} from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { translate } from "@/i18n/runtime";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { getQuotaSnapshotState, type QuotaSnapshot } from "@/lib/usage/quotaSnapshot";

interface Connection {
  id: string;
  provider: string;
  authType: string;
  isActive: boolean;
  testStatus: string;
  priority: number;
  name?: string | null;
  lastError?: string;
  providerSpecificData?: {
    proxyPoolId?: string | null;
    quotaSnapshot?: QuotaSnapshot | null;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ProxyPool {
  id: string;
  name: string;
}

interface EditConnectionModalProps {
  isOpen: boolean;
  connection: Connection | null;
  proxyPools: ProxyPool[];
  autoPauseByQuota: boolean;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

interface FormData {
  name: string;
  priority: number;
  apiKey: string;
  proxyPoolId: string;
  isActive: boolean;
  autoPausedUntil: string | null;
}

export default function EditConnectionModal({ isOpen, connection, proxyPools, autoPauseByQuota, onSave, onClose }: EditConnectionModalProps) {
  const NONE_PROXY_POOL_VALUE = "__none__";
  const [formData, setFormData] = useState<FormData>({
    name: "",
    priority: 1,
    apiKey: "",
    proxyPoolId: NONE_PROXY_POOL_VALUE,
    isActive: true,
    autoPausedUntil: null,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name || "",
        priority: connection.priority || 1,
        apiKey: "",
        proxyPoolId: connection.providerSpecificData?.proxyPoolId || NONE_PROXY_POOL_VALUE,
        isActive: connection.isActive ?? true,
        autoPausedUntil: typeof connection.providerSpecificData?.autoPausedUntil === "string"
          ? connection.providerSpecificData.autoPausedUntil
          : null,
      });
      setTestResult(null);
      setValidationResult(null);
    }
  }, [connection, isOpen]);

  const isOAuth = connection?.authType === "oauth";
  const isCompatible = connection ? (isOpenAICompatibleProvider(connection.provider) || isAnthropicCompatibleProvider(connection.provider)) : false;

  const proxyOptions = [
    { value: NONE_PROXY_POOL_VALUE, label: translate("None") },
    ...(proxyPools || []).map((pool) => ({ value: pool.id, label: pool.name })),
  ];
  const quotaSnapshotState = connection?.providerSpecificData?.quotaSnapshot
    ? getQuotaSnapshotState(connection.providerSpecificData.quotaSnapshot)
    : null;
  const authorityAutoPausedUntil = quotaSnapshotState?.exhausted ? quotaSnapshotState.nextResetAt : null;
  const statusLockedByAutoPause = autoPauseByQuota;
  const autoPauseUntilLabel = authorityAutoPausedUntil
    ? new Date(authorityAutoPausedUntil).toLocaleTimeString("vi-VN", { hour12: false })
    : null;

  const handleTest = async () => {
    if (!connection?.provider) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`/api/providers/${connection.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data.valid ? "success" : "failed");
    } catch { setTestResult("failed"); } finally { setTesting(false); }
  };

  const handleValidate = async () => {
    if (!connection?.provider || !formData.apiKey) return;
    setValidating(true); setValidationResult(null);
    try {
      const res = await fetch("/api/providers/validate", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ provider: connection.provider, apiKey: formData.apiKey }) 
      });
      const data = await res.json();
      setValidationResult(data.valid ? "success" : "failed");
    } catch { setValidationResult("failed"); } finally { setValidating(false); }
  };

  const handleSubmit = async () => {
    if (!connection) return;
    setSaving(true);
    try {
      const updates: any = {
        name: formData.name,
        priority: formData.priority,
        isActive: formData.isActive,
        proxyPoolId: formData.proxyPoolId === NONE_PROXY_POOL_VALUE ? null : formData.proxyPoolId,
      };
      if (!isOAuth && formData.apiKey) {
        updates.apiKey = formData.apiKey;
        if (validationResult === "success") { 
          updates.testStatus = "active"; 
          updates.lastError = null; 
          updates.lastErrorAt = null; 
        }
      }
      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  if (!connection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md rounded-none border-border/50 p-6 shadow-none">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg font-semibold tracking-tight">{translate("Update Connection")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Status Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/5 border border-border/50 rounded-none">
            <div className="flex items-center gap-2">
              <Power className={cn("size-4", formData.isActive ? "text-primary" : "text-muted-foreground")} weight="bold" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">{translate("Status")}</span>
                {statusLockedByAutoPause && (
                  <span className="text-xs text-muted-foreground">
                    {autoPauseUntilLabel
                      ? translate("Auto paused until") + " " + autoPauseUntilLabel
                      : translate("Managed automatically by quota")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formData.isActive ? translate("Active") : translate("Disabled")}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <div className="inline-flex">
                        <Switch
                          checked={formData.isActive}
                          onCheckedChange={(val) => setFormData({ ...formData, isActive: val })}
                          disabled={statusLockedByAutoPause}
                          className="scale-[0.8] data-[state=checked]:bg-primary"
                        />
                      </div>
                    }
                  />
                  {statusLockedByAutoPause && (
                    <TooltipContent>
                      {autoPauseUntilLabel
                        ? `${translate("Status is managed automatically by quota")}. ${translate("Auto paused until")} ${autoPauseUntilLabel}.`
                        : `${translate("Status is managed automatically by quota")}. ${translate("It will be re-enabled after reset when available")}.`}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="px-1 text-xs text-muted-foreground">
              {translate("Identifier")}
            </Label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              placeholder={isOAuth ? translate("Account Name") : translate("Credential Label")}
              className="rounded-none border-border/50 bg-muted/5 h-9 text-sm focus-visible:ring-0 focus-visible:border-primary/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="px-1 text-xs text-muted-foreground">
                {translate("Routing Priority")}
              </Label>
              <Input 
                type="number" 
                value={formData.priority} 
                onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })} 
                className="rounded-none border-border/50 bg-muted/5 h-9 text-sm tabular-nums focus-visible:ring-0 focus-visible:border-primary/50 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="px-1 text-xs text-muted-foreground">
                {translate("Proxy Pool")}
              </Label>
              <Select
                value={formData.proxyPoolId}
                onValueChange={(v) => setFormData({ ...formData, proxyPoolId: v as string })}
              >
                <SelectTrigger className="w-full rounded-none border-border/50 bg-muted/5 h-9 text-xs focus:ring-0 focus:border-primary/50 shadow-none">
                  <SelectValue placeholder={translate("None")}/>
                </SelectTrigger>
                <SelectContent className="rounded-none border-border/50 shadow-none">
                  {proxyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="rounded-none text-xs font-medium focus:bg-muted/50">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isOAuth && (
            <div className="flex flex-col gap-1.5">
              <Label className="px-1 text-xs text-muted-foreground">
                {translate("Access Token")}
              </Label>
              <div className="flex gap-2">
                <Input 
                  type="password" 
                  value={formData.apiKey} 
                  onChange={e => setFormData({ ...formData, apiKey: e.target.value })} 
                  placeholder={translate("Update key...")} 
                  className="flex-1 rounded-none border-border/50 bg-muted/5 h-9 text-sm focus-visible:ring-0 focus-visible:border-primary/50 transition-colors" 
                />
                <Button 
                  type="button"
                  variant="secondary" 
                  size="sm" 
                  onClick={handleValidate} 
                  disabled={!formData.apiKey || validating} 
                  className="h-9 rounded-none px-4 text-xs font-medium"
                >
                  {validating ? <Spinner className="size-4" /> : translate("Verify")}
                </Button>
              </div>
              {validationResult && (
                <div className={cn("mt-1 flex items-center gap-1.5 text-xs font-medium", validationResult === 'success' ? "text-primary" : "text-destructive")}>
                   {validationResult === 'success' ? <CheckCircle className="size-4" weight="bold" /> : <WarningCircle className="size-4" weight="bold" />}
                   {validationResult === 'success' ? translate("Token Validated") : translate("Validation Failed")}
                </div>
              )}
            </div>
          )}

          {!isCompatible && (
            <div className="pt-4 border-t border-border/50 flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground opacity-60" weight="bold" />
                <span className="text-xs text-muted-foreground">
                  {translate("System Health")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {testResult && (
                  <Badge 
                    variant={testResult === 'success' ? 'secondary' : 'destructive'} 
                    className="h-5 rounded-none border-none px-2 text-xs tabular-nums"
                  >
                    {testResult === 'success' ? translate('Link OK') : translate('Link FAIL')}
                  </Badge>
                )}
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={handleTest} 
                  disabled={testing} 
                  className="h-8 rounded-none px-3 text-xs font-medium hover:bg-muted/50"
                >
                  {testing ? <Spinner className="size-4" /> : <><Pulse className="size-4 mr-1.5" weight="bold" /> {translate("Test")}</>}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-6 p-0 border-none bg-transparent">
          <Button 
            type="button"
            variant="outline" 
            className="h-10 flex-1 rounded-none border-border/50 text-xs font-medium hover:bg-muted/30" 
            onClick={onClose}
          >
            {translate("Cancel")}
          </Button>
          <Button 
            type="button"
            className="h-10 flex-1 rounded-none text-xs font-medium shadow-none" 
            onClick={handleSubmit} 
            disabled={saving}
          >
            {saving ? <Spinner className="size-4" /> : <><FloppyDisk className="size-4 mr-2" weight="bold" data-icon="inline-start" /> {translate("Save Changes")}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
