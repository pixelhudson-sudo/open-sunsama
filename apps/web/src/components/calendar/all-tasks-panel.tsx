import * as React from "react";
import { ListTodo, GripVertical, Pencil, Plus } from "lucide-react";
import type { Task } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui";
import { useCompleteTask, useCreateTask } from "@/hooks/useTasks";
import { AddTaskInline } from "@/components/kanban/add-task-inline";
import { TaskContextMenu } from "@/components/kanban/task-context-menu";
import { PriorityManager, usePriorityDefs, type PriorityDef } from "./priority-manager";
import { MobileUnscheduledSheet } from "./mobile-unscheduled-sheet";

const FONT_KEY = "open_sunsama_tasks_font";
const SIZE_KEY = "open_sunsama_tasks_size";

const FONT_OPTIONS = [
  { label: "System", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  { label: "Sans", value: "ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif" },
  { label: "Inter", value: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Palatino", value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, 'Segoe UI', sans-serif" },
];

const SIZE_OPTIONS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

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
  const createTask = useCreateTask();
  const [priorityDefs, setPriorityDefs] = usePriorityDefs();
  const [showPriorityMgr, setShowPriorityMgr] = React.useState(false);

  const fontFamily = React.useMemo(() => {
    if (typeof window === "undefined") return FONT_OPTIONS[0]!.value;
    return localStorage.getItem(FONT_KEY) || FONT_OPTIONS[0]!.value;
  }, []);
  const [font, setFont] = React.useState(fontFamily);
  const fontSize = React.useMemo(() => {
    if (typeof window === "undefined") return SIZE_OPTIONS[2]!;
    return Number(localStorage.getItem(SIZE_KEY)) || SIZE_OPTIONS[2]!;
  }, []);
  const [size, setSize] = React.useState(fontSize);

  const filteredTasks = React.useMemo(() => {
    if (space === "unscheduled") {
      return tasks.filter((t) => !t.scheduledDate || t.scheduledDate !== scheduledDate);
    }
    return tasks;
  }, [tasks, space, scheduledDate]);

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
  };

  const handleAddTaskWithPriority = (priorityId: string, afterTaskId?: string) => {
    const def = priorityDefs.find((d) => d.id === priorityId);
    createTask.mutate({
      title: "",
      priority: priorityId as any,
      scheduledDate,
    });
  };

  const taskCount = filteredTasks.length;

  const panelContent = (
    <>
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
          className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 w-12"
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
            grouped.sortedDefs
              .filter((def) => {
                const groupTasks = grouped.groups.get(def.id) || [];
                return groupTasks.length > 0 || space === "all";
              })
              .map((def) => {
                const groupTasks = grouped.groups.get(def.id) || [];
                const prioritySize = Math.max(def.size || 14, 12);
                return (
                  <div key={def.id}>
                    {/* Priority header — bigger, with edit + add icons */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing select-none group",
                        groupTasks.length === 0 && "opacity-40"
                      )}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("priority-id", def.id);
                      }}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => handlePriorityDrop(def.id, e)}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span style={{ fontSize: prioritySize + 4 }}>{def.emoji}</span>
                      <span className="font-bold" style={{ color: def.color, fontSize: prioritySize }}>
                        {def.label}
                      </span>
                      <span className="text-xs text-muted-foreground/50 ml-1">{groupTasks.length}</span>
                      <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PriorityManager defs={priorityDefs} onChange={setPriorityDefs}>
                          <button className="p-1 rounded hover:bg-muted" title="Edit priority">
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </PriorityManager>
                        <button
                          className="p-1 rounded hover:bg-muted"
                          title="Add task with this priority"
                          onClick={() => handleAddTaskWithPriority(def.id)}
                        >
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Tasks in this priority */}
                    {groupTasks.map((task) => (
                      <TaskContextMenu
                        key={task.id}
                        task={task}
                        onEdit={() => onTaskClick?.(task)}
                      >
                        <div
                          className="cursor-grab active:cursor-grabbing group/task relative"
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
                          <button
                            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/task:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                            title="Add task below with same priority"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddTaskWithPriority(def.id, task.id);
                            }}
                          >
                            <Plus className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
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
        "hover:bg-accent/30 cursor-pointer"
      )}
      onClick={onClick}
      style={{ fontFamily: font, fontSize: size }}
    >
      <div
        className={cn(
          "h-3 w-3 shrink-0 rounded-full border cursor-pointer flex items-center justify-center transition-colors",
          task.completedAt
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 hover:border-primary"
        )}
        onClick={onToggleComplete}
      />
      <span className="text-[10px] shrink-0 leading-none">{priorityDef.emoji}</span>
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
