import * as React from "react";
import { ListTodo, GripVertical } from "lucide-react";
import type { Task } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui";
import { useCompleteTask } from "@/hooks/useTasks";
import { AddTaskInline } from "@/components/kanban/add-task-inline";
import { TaskContextMenu } from "@/components/kanban/task-context-menu";
import { PriorityManager, getPriorityDefs, savePriorityDefs, usePriorityDefs, type PriorityDef } from "./priority-manager";
import { MobileUnscheduledSheet } from "./mobile-unscheduled-sheet";

const FONT_KEY = "open_sunsama_tasks_font";
const SIZE_KEY = "open_sunsama_tasks_size";

const FONT_OPTIONS = [
  { label: "System", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  { label: "Sans", value: "ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif" },
  { label: "Compact", value: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" },
];

const SIZE_OPTIONS = [10, 11, 12, 13];

interface AllTasksPanelProps {
  tasks: Task[];
  isLoading?: boolean;
  scheduledDate: string;
  onTaskDragStart?: (task: Task, e: React.MouseEvent) => void;
  onTaskClick?: (task: Task) => void;
  className?: string;
}

export function AllTasksPanel({
  tasks,
  isLoading = false,
  scheduledDate,
  onTaskDragStart,
  onTaskClick,
  className,
}: AllTasksPanelProps) {
  const [space, setSpace] = React.useState<"all" | "unscheduled">("all");
  const completeTask = useCompleteTask();
  const [priorityDefs, setPriorityDefs] = usePriorityDefs();
  const [dndPriorityId, setDndPriorityId] = React.useState<string | null>(null);

  const fontFamily = React.useMemo(() => {
    if (typeof window === "undefined") return FONT_OPTIONS[0]!.value;
    return localStorage.getItem(FONT_KEY) || FONT_OPTIONS[0]!.value;
  }, []);
  const [font, setFont] = React.useState(fontFamily);
  const fontSize = React.useMemo(() => {
    if (typeof window === "undefined") return 11;
    return Number(localStorage.getItem(SIZE_KEY)) || 11;
  }, []);
  const [size, setSize] = React.useState(fontSize);

  const filteredTasks = React.useMemo(() => {
    if (space === "unscheduled") {
      return tasks.filter((t) => !t.scheduledDate || t.scheduledDate !== scheduledDate);
    }
    return tasks;
  }, [tasks, space, scheduledDate]);

  // Group by priority
  const grouped = React.useMemo(() => {
    const groups = new Map<string, Task[]>();
    const sortedDefs = [...priorityDefs].sort((a, b) => a.order - b.order);
    for (const def of sortedDefs) {
      groups.set(def.id, []);
    }
    for (const task of filteredTasks) {
      const id = task.priority;
      if (groups.has(id)) {
        groups.get(id)!.push(task);
      } else {
        groups.set(id, [task]);
      }
    }
    return { groups, sortedDefs };
  }, [filteredTasks, priorityDefs]);

  const setFontAndStore = (v: string) => {
    setFont(v);
    localStorage.setItem(FONT_KEY, v);
  };
  const setSizeAndStore = (v: number) => {
    setSize(v);
    localStorage.setItem(SIZE_KEY, String(v));
  };

  const handlePriorityDrop = (defId: string, e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("priority-id");
    if (!draggedId || draggedId === defId) return;
    const defs = [...priorityDefs];
    const fromIdx = defs.findIndex((d) => d.id === draggedId);
    const toIdx = defs.findIndex((d) => d.id === defId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = defs.splice(fromIdx, 1);
    if (!moved) return;
    defs.splice(toIdx, 0, moved);
    defs.forEach((d, i) => (d.order = i));
    setPriorityDefs(defs);
    setDndPriorityId(null);
  };

  const taskCount = filteredTasks.length;

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <button
            className="text-xs font-semibold cursor-pointer hover:text-primary"
            onClick={() => setSpace(space === "all" ? "unscheduled" : "all")}
            title="Toggle all/unscheduled"
          >
            {space === "all" ? "Tasks" : "Unscheduled"}
          </button>
          {taskCount > 0 && (
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted leading-none">
              {taskCount}
            </span>
          )}
        </div>
        <AddTaskInline scheduledDate={scheduledDate} compact />
      </div>

      {/* Font + Priority controls */}
      <div className="border-b px-3 py-1.5 flex items-center gap-1.5">
        <select
          className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 flex-1 min-w-0"
          value={font}
          onChange={(e) => setFontAndStore(e.target.value)}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 w-10"
          value={size}
          onChange={(e) => setSizeAndStore(Number(e.target.value))}
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <PriorityManager defs={priorityDefs} onChange={setPriorityDefs}>
          <button className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted shrink-0">
            P
          </button>
        </PriorityManager>
      </div>

      {/* Task List */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {isLoading ? (
            <>
              <div className="h-7 bg-muted/50 rounded animate-pulse" />
              <div className="h-7 bg-muted/50 rounded animate-pulse" />
              <div className="h-7 bg-muted/50 rounded animate-pulse" />
            </>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <div className="rounded-full bg-muted p-2 mb-2">
                <ListTodo className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                No tasks{space === "all" ? "" : " available"}
              </p>
            </div>
          ) : (
            grouped.sortedDefs.map((def) => {
              const groupTasks = grouped.groups.get(def.id) || [];
              if (groupTasks.length === 0 && space !== "all") return null;
              return (
                <div key={def.id}>
                  {/* Priority header */}
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium cursor-grab active:cursor-grabbing select-none",
                      groupTasks.length === 0 && "opacity-40"
                    )}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("priority-id", def.id);
                      setDndPriorityId(def.id);
                    }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => handlePriorityDrop(def.id, e)}
                    onDragEnd={() => setDndPriorityId(null)}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs">{def.emoji}</span>
                    <span style={{ color: def.color }}>{def.label}</span>
                    <span className="text-muted-foreground ml-auto">{groupTasks.length}</span>
                  </div>

                  {/* Tasks in this priority */}
                  {groupTasks.map((task) => (
                    <TaskContextMenu
                      key={task.id}
                      task={task}
                      onEdit={() => onTaskClick?.(task)}
                    >
                      <div
                        className="cursor-grab active:cursor-grabbing"
                        onMouseDown={(e) => onTaskDragStart?.(task, e)}
                      >
                        <CompactTaskCard
                          task={task}
                          priorityDef={def}
                          onToggleComplete={(e) => {
                            e.stopPropagation();
                            completeTask.mutate({ id: task.id, completed: !task.completedAt });
                          }}
                          onClick={() => onTaskClick?.(task)}
                          font={font}
                          size={size}
                        />
                      </div>
                    </TaskContextMenu>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <>
      <div
        className={cn(
          "hidden md:flex w-72 flex-col border-r bg-muted/30",
          className
        )}
      >
        {panelContent}
      </div>
      <MobileUnscheduledSheet
        tasks={tasks}
        isLoading={isLoading}
        onTaskDragStart={onTaskDragStart}
        onTaskClick={onTaskClick}
      />
    </>
  );
}

function CompactTaskCard({
  task,
  priorityDef,
  onToggleComplete,
  onClick,
  font,
  size,
}: {
  task: Task;
  priorityDef: PriorityDef;
  onToggleComplete: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  font: string;
  size: number;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
        "hover:bg-accent/30 cursor-pointer",
        task.completedAt && "opacity-50"
      )}
      onClick={onClick}
      style={{ fontFamily: font, fontSize: size }}
    >
      {/* Circle checkbox */}
      <div
        className={cn(
          "h-3 w-3 shrink-0 rounded-full border cursor-pointer flex items-center justify-center transition-colors",
          task.completedAt
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 hover:border-primary"
        )}
        onClick={onToggleComplete}
      />
      {/* Priority emoji */}
      <span className="text-[10px] shrink-0 leading-none">{priorityDef.emoji}</span>
      {/* Title */}
      <span
        className={cn(
          "flex-1 min-w-0 truncate leading-tight",
          task.completedAt && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>
    </div>
  );
}
