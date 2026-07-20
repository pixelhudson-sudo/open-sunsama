import * as React from "react";
import { Plus, GripVertical, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";

export interface PriorityDef {
  id: string;
  label: string;
  color: string;
  emoji: string;
  order: number;
  size: number;
}

const STORAGE_KEY = "open_sunsama_priority_defs";

const EMOJI_LIST = ["🔥","⭐","🔵","🟢","🟡","🟠","🔴","🟣","⚪","💎","📌","🎯","⚡","💡","📊","✅","🔄","🚀","💪","🎯","🏆","💀","👑","🌈","🍀","🎨","🛠️","💻","📱","🎮","📚","💰","❤️","💙","💚","💛","🧡","🤍","🖤","💜"];

const COLOR_PRESETS = [
  "#ef4444","#dc2626","#b91c1c","#f97316","#ea580c","#f59e0b","#d97706","#eab308",
  "#84cc16","#65a30d","#22c55e","#16a34a","#10b981","#059669","#14b8a6","#0d9488",
  "#06b6d4","#0891b2","#3b82f6","#2563eb","#6366f1","#4f46e5","#8b5cf6","#7c3aed",
  "#a855f7","#9333ea","#d946ef","#c026d3","#ec4899","#db2777",
];

const defaultPriorities: PriorityDef[] = [
  { id: "P1", label: "P1", color: "#ef4444", emoji: "🔥", order: 0, size: 14 },
  { id: "P2", label: "P2", color: "#f59e0b", emoji: "⭐", order: 1, size: 14 },
  { id: "P3", label: "P3", color: "#3b82f6", emoji: "🔵", order: 2, size: 14 },
  { id: "P4", label: "P4", color: "#6b7280", emoji: "⚪", order: 3, size: 14 },
];

export function getPriorityDefs(): PriorityDef[] {
  if (typeof window === "undefined") return defaultPriorities;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PriorityDef[];
  } catch {}
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

interface PriorityManagerProps {
  defs: PriorityDef[];
  onChange: (defs: PriorityDef[]) => void;
  children?: React.ReactNode;
}

export function PriorityManager({ defs, onChange, children }: PriorityManagerProps) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PriorityDef | null>(null);
  const [nextId, setNextId] = React.useState(5);

  React.useEffect(() => {
    if (open) {
      const max = defs.reduce((m, d) => {
        const num = parseInt(d.id.replace("P", ""), 10);
        return isNaN(num) ? m : Math.max(m, num);
      }, 4);
      setNextId(max + 1);
    }
  }, [open, defs]);

  const startCreate = () => {
    const id = `P${nextId}`;
    setEditing({ id, label: id, color: "#8b5cf6", emoji: "📌", order: defs.length, size: 14 });
    setNextId(nextId + 1);
  };

  const startEdit = (def: PriorityDef) => {
    setEditing({ ...def });
  };

  const handleSave = () => {
    if (!editing) return;
    const existing = defs.find((d) => d.id === editing.id);
    if (existing) {
      onChange(defs.map((d) => d.id === editing.id ? { ...editing } : d));
    } else {
      onChange([...defs, { ...editing, order: defs.length }]);
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const def = defs.find((d) => d.id === id);
    if (!window.confirm(`Delete priority "${def?.label}"?`)) return;
    onChange(defs.filter((d) => d.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Manage Priorities</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
          {[...defs].sort((a, b) => a.order - b.order).map((def) => (
            <div key={def.id}>
              {editing?.id === def.id ? (
                <PriorityEditRow def={editing} onChange={setEditing} onSave={handleSave} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs group">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                  <span className="text-base">{def.emoji}</span>
                  <div
                    className="w-4 h-4 rounded shrink-0 border"
                    style={{ backgroundColor: def.color }}
                  />
                  <div className="flex-1 font-semibold" style={{ fontSize: def.size }}>{def.label}</div>
                  <span className="text-[10px] text-muted-foreground">{def.size}px</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] hover:bg-muted"
                    onClick={() => startEdit(def)}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="px-1.5 py-0.5 rounded text-[10px] hover:bg-destructive/10 text-destructive"
                    onClick={() => handleDelete(def.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" /> Add priority
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PriorityEditRow({
  def,
  onChange,
  onSave,
  onCancel,
}: {
  def: PriorityDef;
  onChange: (d: PriorityDef) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3 text-xs">
      <div className="flex items-center gap-2">
        <Input
          className="h-7 text-xs flex-1"
          value={def.label}
          onChange={(e) => onChange({ ...def, label: e.target.value })}
          placeholder="Label"
        />
        <Input
          className="h-7 text-xs w-16"
          type="number"
          min={10}
          max={32}
          value={def.size}
          onChange={(e) => onChange({ ...def, size: parseInt(e.target.value, 10) || 14 })}
          title="Font size (px)"
        />
        <Button size="sm" className="h-7 text-[10px]" onClick={onSave}>Save</Button>
        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={onCancel}>Cancel</Button>
      </div>
      {/* Emoji picker */}
      <div className="flex flex-wrap gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-sm",
              def.emoji === emoji && "bg-muted ring-1 ring-primary"
            )}
            onClick={() => onChange({ ...def, emoji })}
          >
            {emoji}
          </button>
        ))}
      </div>
      {/* Color presets */}
      <div className="flex flex-wrap gap-1">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            className={cn(
              "w-5 h-5 rounded-full border border-border",
              def.color === c && "ring-2 ring-offset-1 ring-primary"
            )}
            style={{ backgroundColor: c }}
            onClick={() => onChange({ ...def, color: c })}
          />
        ))}
      </div>
    </div>
  );
}
