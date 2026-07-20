import * as React from "react";
import { Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";

export interface PriorityDef {
  id: string;
  label: string;
  color: string;
  emoji: string;
  order: number;
}

const STORAGE_KEY = "open_sunsama_priority_defs";

const defaultPriorities: PriorityDef[] = [
  { id: "P1", label: "P1", color: "#ef4444", emoji: "", order: 0 },
  { id: "P2", label: "P2", color: "#f59e0b", emoji: "", order: 1 },
  { id: "P3", label: "P3", color: "#3b82f6", emoji: "", order: 2 },
  { id: "P4", label: "P4", color: "#6b7280", emoji: "", order: 3 },
];

export function getPriorityDefs(): PriorityDef[] {
  if (typeof window === "undefined") return defaultPriorities;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PriorityDef[];
  } catch { /* fall through */ }
  return defaultPriorities;
}

export function savePriorityDefs(defs: PriorityDef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defs));
}

export function usePriorityDefs(): [PriorityDef[], (defs: PriorityDef[]) => void] {
  const [defs, setDefs] = React.useState<PriorityDef[]>(getPriorityDefs);
  const save = React.useCallback((next: PriorityDef[]) => {
    setDefs(next);
    savePriorityDefs(next);
  }, []);
  return [defs, save];
}

const EMOJI_LIST = ["🔥","⭐","🔵","🟢","🟡","🟠","🔴","🟣","⚪","💎","📌","🎯","⚡","💡","📊","✅","🔄","🚀","💪","🎯"];

interface PriorityManagerProps {
  defs: PriorityDef[];
  onChange: (defs: PriorityDef[]) => void;
  children?: React.ReactNode;
}

export function PriorityManager({ defs, onChange, children }: PriorityManagerProps) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<{ id: string; label: string; color: string; emoji: string } | null>(null);

  const handleCreate = () => {
    const nextId = `P${defs.length + 1}`;
    setEditing({ id: nextId, label: nextId, color: "#8b5cf6", emoji: "📌" });
  };

  const handleSave = () => {
    if (!editing) return;
    const existing = defs.find((d) => d.id === editing.id);
    if (existing) {
      onChange(defs.map((d) => d.id === editing.id ? { ...d, label: editing.label, color: editing.color, emoji: editing.emoji } : d));
    } else {
      onChange([...defs, { id: editing.id, label: editing.label, color: editing.color, emoji: editing.emoji, order: defs.length }]);
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(`Delete priority "${defs.find((d) => d.id === id)?.label}"?`)) return;
    onChange(defs.filter((d) => d.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Manage Priorities</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {[...defs].sort((a, b) => a.order - b.order).map((def, idx) => (
            <div key={def.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
              {editing?.id === def.id ? (
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    className="w-7 text-center bg-transparent border rounded px-1 py-0.5 text-xs"
                    value={editing.emoji}
                    onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                    placeholder="emoji"
                  />
                  <Input
                    className="h-6 text-xs flex-1"
                    value={editing.label}
                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  />
                  <input
                    type="color"
                    className="w-6 h-6 p-0 border rounded cursor-pointer"
                    value={editing.color}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  />
                  <Button size="sm" className="h-6 text-[10px]" onClick={handleSave}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <span className="text-sm">{def.emoji}</span>
                  <div className="flex-1 font-medium">{def.label}</div>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
                  <button
                    className="px-1.5 py-0.5 rounded text-[10px] hover:bg-muted text-muted-foreground"
                    onClick={() => setEditing({ id: def.id, label: def.label, color: def.color, emoji: def.emoji })}
                  >
                    Edit
                  </button>
                  <button
                    className="px-1.5 py-0.5 rounded text-[10px] hover:bg-destructive/10 text-destructive"
                    onClick={() => handleDelete(def.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" /> Add priority
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
