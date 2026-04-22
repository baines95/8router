"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Plus, 
  Layers, 
  Copy, 
  Check, 
  Edit2, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  X,
  Search,
  Zap,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import ModelSelectModal from "@/shared/components/ModelSelectModal";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export default function CombosPageClient({ initialData }) {
  const [combos, setCombos] = useState(initialData?.combos || []);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState(initialData?.connections || []);
  const [comboStrategies, setComboStrategies] = useState(initialData?.settings?.comboStrategies || {});
  const { copied, copy } = useCopyToClipboard();

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, settingsRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/settings"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      
      if (combosRes.ok) setCombos(combosData.combos || []);
      if (providersRes.ok) setActiveProviders(providersData.connections || []);
      setComboStrategies(settingsData.comboStrategies || {});
    } catch (error) {
      console.log("Error fetching data:", error);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setShowCreateModal(false);
      }
    } catch (error) { console.log(error); }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setEditingCombo(null);
      }
    } catch (error) { console.log(error); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this combo?")) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (res.ok) setCombos(combos.filter(c => c.id !== id));
    } catch (error) { console.log(error); }
  };

  const handleToggleRoundRobin = async (comboName, enabled) => {
    try {
      const updated = { ...comboStrategies };
      if (enabled) updated[comboName] = { fallbackStrategy: "round-robin" };
      else delete updated[comboName];
      
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategies: updated }),
      });
      setComboStrategies(updated);
    } catch (error) { console.log(error); }
  };

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 py-6 px-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
            <Layers className="size-4" />
            Infrastructure
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Model Combos</h1>
          <p className="text-sm text-muted-foreground font-medium">
            Define intelligent model groups with automatic fallback strategies.
          </p>
        </div>

        <Button size="sm" className="font-bold text-[10px] uppercase tracking-widest h-8 px-4" onClick={() => setShowCreateModal(true)}>
          <Plus className="size-3.5 mr-2" /> Create Combo
        </Button>
      </header>

      {/* Combos List */}
      <div className="grid gap-4">
        {combos.length === 0 ? (
          <Card className="shadow-none border-border border-dashed bg-muted/5 py-20 text-center flex flex-col items-center justify-center opacity-30">
            <Layers className="size-12 mb-3" />
            <p className="text-sm font-bold uppercase tracking-widest">No combos configured</p>
          </Card>
        ) : (
          combos.map((combo) => (
            <ComboCard
              key={combo.id}
              combo={combo}
              copied={copied}
              onCopy={copy}
              onEdit={() => setEditingCombo(combo)}
              onDelete={() => handleDelete(combo.id)}
              roundRobinEnabled={comboStrategies[combo.name]?.fallbackStrategy === "round-robin"}
              onToggleRoundRobin={(enabled) => handleToggleRoundRobin(combo.name, enabled)}
            />
          ))
        )}
      </div>

      <ComboFormModal
        key="create"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        activeProviders={activeProviders}
      />

      {editingCombo && (
        <ComboFormModal
          key={editingCombo.id}
          isOpen={!!editingCombo}
          combo={editingCombo}
          onClose={() => setEditingCombo(null)}
          onSave={(data) => handleUpdate(editingCombo.id, data)}
          activeProviders={activeProviders}
        />
      )}
    </div>
  );
}

function ComboCard({ combo, copied, onCopy, onEdit, onDelete, roundRobinEnabled, onToggleRoundRobin }) {
  return (
    <Card className="shadow-none border-border overflow-hidden p-0 group">
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="size-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
            <Layers className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <code className="text-sm font-bold font-mono tracking-tight text-foreground truncate">{combo.name}</code>
              <Badge variant="outline" className="h-4 text-[8px] font-black uppercase border-border text-muted-foreground">{combo.models.length} MODELS</Badge>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {combo.models.slice(0, 4).map((model, index) => (
                <code key={index} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground opacity-80 border border-border/50">
                  {model}
                </code>
              ))}
              {combo.models.length > 4 && (
                <span className="text-[10px] text-muted-foreground font-bold">+{combo.models.length - 4}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground opacity-60">Round Robin</span>
                <Switch size="sm" checked={roundRobinEnabled} onCheckedChange={onToggleRoundRobin} className="scale-75 data-[state=checked]:bg-emerald-500" />
             </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8 hover:bg-primary/5 text-muted-foreground hover:text-primary" onClick={() => onCopy(combo.name, `combo-${combo.id}`)}>
              {copied === `combo-${combo.id}` ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-8 hover:bg-primary/5 text-muted-foreground hover:text-primary" onClick={onEdit}>
              <Edit2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 hover:bg-red-500/5 text-muted-foreground hover:text-red-500" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ModelItem({ index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    else setDraft(model);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 group/item transition-colors hover:bg-muted/40">
      <span className="text-[10px] font-bold text-muted-foreground w-4 text-center shrink-0">{index + 1}</span>
      {editing ? (
        <Input 
          autoFocus 
          value={draft} 
          onChange={e => setDraft(e.target.value)} 
          onBlur={commit} 
          onKeyDown={e => e.key === "Enter" && commit()} 
          className="h-7 text-xs font-mono py-0 flex-1 bg-background" 
        />
      ) : (
        <div className="flex-1 min-w-0 text-xs font-mono truncate cursor-text" onClick={() => setEditing(true)}>
          {model}
        </div>
      )}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-primary" onClick={onMoveUp} disabled={isFirst}><ArrowUp className="size-3" /></Button>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-primary" onClick={onMoveDown} disabled={isLast}><ArrowDown className="size-3" /></Button>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-red-500" onClick={onRemove}><X className="size-3" /></Button>
      </div>
    </div>
  );
}

function ComboFormModal({ isOpen, combo, onClose, onSave, activeProviders }) {
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetch("/api/models/alias").then(r => r.ok ? r.json() : {}).then(d => setModelAliases(d.aliases || {}));
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim() || !VALID_NAME_REGEX.test(name)) {
      setNameError("Invalid name");
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), models });
    setSaving(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{combo ? "Edit Combo" : "New Combo"}</DialogTitle>
            <DialogDescription>Define a group of models for priority routing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Combo Identifier</Label>
              <Input value={name} onChange={e => { setName(e.target.value); setNameError(""); }} placeholder="e.g. gpt-4-group" />
              {nameError && <p className="text-[10px] text-destructive font-bold">{nameError}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Model Pipeline</Label>
                <Badge variant="outline" className="h-4 text-[8px] font-bold uppercase border-border">{models.length} SLOTS</Badge>
              </div>
              
              <ScrollArea className="max-h-[300px] pr-3">
                <div className="space-y-1.5">
                  {models.map((m, i) => (
                    <ModelItem 
                      key={i} 
                      index={i} 
                      model={m} 
                      isFirst={i === 0} 
                      isLast={i === models.length - 1}
                      onEdit={val => { const next = [...models]; next[i] = val; setModels(next); }}
                      onMoveUp={() => { const next = [...models]; [next[i-1], next[i]] = [next[i], next[i-1]]; setModels(next); }}
                      onMoveDown={() => { const next = [...models]; [next[i], next[i+1]] = [next[i+1], next[i]]; setModels(next); }}
                      onRemove={() => setModels(models.filter((_, idx) => idx !== i))}
                    />
                  ))}
                  {models.length === 0 && (
                    <div className="py-10 text-center border-2 border-dashed rounded-xl opacity-20">
                      <p className="text-[10px] font-bold uppercase tracking-widest">No models selected</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-bold uppercase tracking-widest" onClick={() => setShowModelSelect(true)}>
                <Plus className="size-3 mr-2" /> Add Model Slot
              </Button>
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" className="font-bold text-[10px] uppercase tracking-widest h-9" onClick={onClose}>Cancel</Button>
             <Button className="font-bold text-[10px] uppercase tracking-widest h-9 px-8" onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Saving..." : "Save Combo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModelSelectModal
        isOpen={showModelSelect}
        onClose={() => setShowModelSelect(false)}
        onSelect={m => !models.includes(m.value) && setModels([...models, m.value])}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title="Select Model Slot"
      />
    </>
  );
}
