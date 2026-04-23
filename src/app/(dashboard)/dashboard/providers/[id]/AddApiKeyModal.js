"use client";

import { useState } from"react";
import PropTypes from"prop-types";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { translate } from "@/i18n/runtime";

export default function AddApiKeyModal({
 isOpen,
 provider,
 providerName,
 isCompatible,
 isAnthropic,
 proxyPools,
 onSave,
 onClose,
}) {
 const NONE_PROXY_POOL_VALUE ="__none__";

 const [formData, setFormData] = useState({
 name:"",
 apiKey:"",
 priority: 1,
 proxyPoolId: NONE_PROXY_POOL_VALUE,
 });
 const [validating, setValidating] = useState(false);
 const [validationResult, setValidationResult] = useState(null);
 const [saving, setSaving] = useState(false);

 const proxyOptions = [
 { value: NONE_PROXY_POOL_VALUE, label:"None"},
 ...(proxyPools || []).map((pool) => ({ value: pool.id, label: pool.name })),
 ];

 const handleValidate = async () => {
 setValidating(true);
 try {
 const res = await fetch("/api/providers/validate", {
 method:"POST",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ provider, apiKey: formData.apiKey }),
 });
 const data = await res.json();
 setValidationResult(data.valid ?"success":"failed");
 } catch {
 setValidationResult("failed");
 } finally {
 setValidating(false);
 }
 };

 const handleSubmit = async () => {
 if (!provider || !formData.apiKey) return;

 setSaving(true);
 try {
 let isValid = false;
 try {
 setValidating(true);
 setValidationResult(null);
 const res = await fetch("/api/providers/validate", {
 method:"POST",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ provider, apiKey: formData.apiKey }),
 });
 const data = await res.json();
 isValid = !!data.valid;
 setValidationResult(isValid ?"success":"failed");
 } catch {
 setValidationResult("failed");
 } finally {
 setValidating(false);
 }

 await onSave({
 name: formData.name,
 apiKey: formData.apiKey,
 priority: formData.priority,
 proxyPoolId:
 formData.proxyPoolId === NONE_PROXY_POOL_VALUE
 ? null
 : formData.proxyPoolId,
 testStatus: isValid ?"active":"unknown",
 providerSpecificData: undefined,
 });
 } finally {
 setSaving(false);
 }
 };

 if (!provider) return null;

 return (
 <Dialog
 open={isOpen}
 onOpenChange={(open) => {
 if (!open) onClose();
 }}
 >
 <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg rounded-none border-border/50">
 <DialogHeader>
 <DialogTitle>{translate("Add")} {providerName || provider} API Key</DialogTitle>
 </DialogHeader>
 <div className="flex flex-col gap-4">
 <div className="flex flex-col gap-2">
 <Label htmlFor="add-key-name" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground opacity-60">
 {translate("Name")}
 </Label>
 <Input
 id="add-key-name"
 value={formData.name}
 onChange={(e) =>
 setFormData({ ...formData, name: e.target.value })
 }
 placeholder="Production Key"
 className="rounded-none border-border/50 bg-muted/5"
 />
 </div>
 <div className="flex gap-2">
 <div className="min-w-0 flex-1 flex flex-col gap-2">
 <Label htmlFor="add-key-secret" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground opacity-60">
 API Key
 </Label>
 <Input
 id="add-key-secret"
 type="password"
 value={formData.apiKey}
 onChange={(e) =>
 setFormData({ ...formData, apiKey: e.target.value })
 }
 className="rounded-none border-border/50 bg-muted/5"
 />
 </div>
 <div className="flex items-end">
 <Button
 type="button"
 variant="secondary"
 onClick={handleValidate}
 disabled={!formData.apiKey || validating || saving}
 className="h-8 rounded-none px-3 text-xs font-semibold"
 >
 {validating ? <Spinner className="size-3.5" /> : translate("Check")}
 </Button>
 </div>
 </div>
 {validationResult &&
 (validationResult ==="success"? (
 <Badge className="border-primary/20 bg-primary/10 text-primary dark:text-primary rounded-none h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider">
 {translate("Valid")}
 </Badge>
 ) : (
 <Badge variant="destructive" className="rounded-none h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider">
 {translate("Invalid")}
 </Badge>
 ))}
 {isCompatible && (
 <p className="text-[10px] text-muted-foreground font-medium italic opacity-70">
 {isAnthropic
 ? translate(`Validation checks ${providerName ||"Anthropic Compatible"} by verifying the API key.`)
 : translate(`Validation checks ${providerName ||"OpenAI Compatible"} via /models on your base URL.`)}
 </p>
 )}
 <div className="flex flex-col gap-2">
 <Label htmlFor="add-key-priority" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground opacity-60">
 {translate("Priority")}
 </Label>
 <Input
 id="add-key-priority"
 type="number"
 value={formData.priority}
 onChange={(e) =>
 setFormData({
 ...formData,
 priority: Number.parseInt(e.target.value, 10) || 1,
 })
 }
 className="rounded-none border-border/50 bg-muted/5 tabular-nums"
 />
 </div>
 <div className="flex flex-col gap-2">
 <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground opacity-60">
 {translate("Proxy Pool")}
 </Label>
 <Select
 value={formData.proxyPoolId}
 onValueChange={(v) =>
 setFormData({ ...formData, proxyPoolId: v })
 }
 >
 <SelectTrigger className="w-full rounded-none border-border/50 bg-muted/5 h-8 text-xs">
 <SelectValue placeholder="None"/>
 </SelectTrigger>
 <SelectContent className="rounded-none">
 {proxyOptions.map((opt) => (
 <SelectItem key={opt.value} value={opt.value} className="rounded-none">
 {opt.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 {(proxyPools || []).length === 0 && (
 <p className="text-[10px] text-muted-foreground font-medium italic opacity-70">
 {translate("No active proxy pools available. Create one in Proxy Pools page first.")}
 </p>
 )}
 <div className="flex gap-2 pt-2">
 <Button
 type="button"
 className="flex-1 rounded-none h-8 text-xs font-bold uppercase tracking-wider"
 onClick={handleSubmit}
 disabled={!formData.name || !formData.apiKey || saving}
 >
 {saving ? <Spinner className="size-3.5" /> : translate("Save")}
 </Button>
 <Button
 type="button"
 variant="secondary"
 className="flex-1 rounded-none h-8 text-xs font-bold uppercase tracking-wider"
 onClick={onClose}
 >
 {translate("Cancel")}
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}

AddApiKeyModal.propTypes = {
 isOpen: PropTypes.bool.isRequired,
 provider: PropTypes.string,
 providerName: PropTypes.string,
 isCompatible: PropTypes.bool,
 isAnthropic: PropTypes.bool,
 proxyPools: PropTypes.arrayOf(
 PropTypes.shape({
 id: PropTypes.string,
 name: PropTypes.string,
 }),
 ),
 onSave: PropTypes.func.isRequired,
 onClose: PropTypes.func.isRequired,
};
