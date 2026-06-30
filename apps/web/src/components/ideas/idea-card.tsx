import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, addDays, startOfWeek } from "date-fns";
import {
  Check,
  MoreHorizontal,
  LayoutGrid,
  Inbox,
  Calendar,
  Pencil,
  Columns3,
  Trash2,
  ListChecks,
} from "lucide-react";
import type { Idea, IdeaColumn } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui";
import { HtmlContent } from "@/components/ui/html-content";
import {
  useDeleteIdea,
  usePromoteIdea,
  useUpdateIdea,
} from "@/hooks/useIdeas";
import { IdeaEditDialog } from "./idea-edit-dialog";

interface IdeaCardProps {
  idea: Idea;
  boardId: string;
  columns: IdeaColumn[];
  /** Rendered inside a DragOverlay — disables sortable wiring + menus. */
  overlay?: boolean;
}

/** Menu family — lets one render path drive both the ⋯ dropdown and the
 * right-click context menu without duplicating the item list. */
interface MenuFamily {
  Item: React.ElementType;
  Separator: React.ElementType;
  Sub: React.ElementType;
  SubTrigger: React.ElementType;
  SubContent: React.ElementType;
}

const DROPDOWN_FAMILY: MenuFamily = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

const CONTEXT_FAMILY: MenuFamily = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

interface IdeaMenuHandlers {
  onAddToToday: () => void;
  onSendToBacklog: () => void;
  onScheduleTomorrow: () => void;
  onScheduleNextWeek: () => void;
  onEdit: () => void;
  onMoveToColumn: (columnId: string) => void;
  onDelete: () => void;
}

/** The shared item list for both menu families. */
function IdeaMenuItems({
  family: C,
  handlers,
  otherColumns,
}: {
  family: MenuFamily;
  handlers: IdeaMenuHandlers;
  otherColumns: IdeaColumn[];
}) {
  return (
    <>
      <C.Item onSelect={handlers.onAddToToday}>
        <LayoutGrid className="mr-2 h-4 w-4" />
        Add to Today
      </C.Item>
      <C.Item onSelect={handlers.onSendToBacklog}>
        <Inbox className="mr-2 h-4 w-4" />
        Send to Backlog
      </C.Item>
      <C.Sub>
        <C.SubTrigger>
          <Calendar className="mr-2 h-4 w-4" />
          Schedule
        </C.SubTrigger>
        <C.SubContent>
          <C.Item onSelect={handlers.onScheduleTomorrow}>Tomorrow</C.Item>
          <C.Item onSelect={handlers.onScheduleNextWeek}>Next week</C.Item>
        </C.SubContent>
      </C.Sub>

      <C.Separator />

      <C.Item onSelect={handlers.onEdit}>
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </C.Item>
      {otherColumns.length > 0 && (
        <C.Sub>
          <C.SubTrigger>
            <Columns3 className="mr-2 h-4 w-4" />
            Move to column
          </C.SubTrigger>
          <C.SubContent>
            {otherColumns.map((col) => (
              <C.Item
                key={col.id}
                onSelect={() => handlers.onMoveToColumn(col.id)}
              >
                {col.name}
              </C.Item>
            ))}
          </C.SubContent>
        </C.Sub>
      )}

      <C.Separator />

      <C.Item
        onSelect={handlers.onDelete}
        className="text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </C.Item>
    </>
  );
}

/**
 * An idea card. Visually the same component as the kanban task card
 * (task-card-content.tsx): circle checkbox + title + optional muted note,
 * a subtask counter, and both a ⋯ menu and a right-click context menu that
 * mirror the task actions, adapted for Ideas.
 */
export function IdeaCard({ idea, boardId, columns, overlay }: IdeaCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const updateIdea = useUpdateIdea(boardId);
  const deleteIdea = useDeleteIdea(boardId);
  const promoteIdea = usePromoteIdea(boardId);

  const sortable = useSortable({
    id: idea.id,
    data: { type: "idea", columnId: idea.columnId, idea },
    disabled: overlay,
  });

  const isCompleted = !!idea.completedAt;
  const inPlanner = !!idea.promotedTaskId;
  const hasNotes =
    !!idea.notes && idea.notes.replace(/<[^>]*>/g, "").trim().length > 0;
  const subtaskTotal = idea.subtaskCount ?? 0;
  const subtaskDone = idea.subtaskDoneCount ?? 0;

  const style: React.CSSProperties = overlay
    ? {}
    : {
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.4 : undefined,
      };

  const toggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateIdea.mutate({
      id: idea.id,
      input: { completedAt: isCompleted ? null : new Date() },
    });
  };

  const handleClick = () => {
    if (!sortable.isDragging) setEditOpen(true);
  };

  const otherColumns = columns.filter((c) => c.id !== idea.columnId);

  const handlers: IdeaMenuHandlers = {
    onAddToToday: () =>
      promoteIdea.mutate({
        id: idea.id,
        input: { scheduledDate: format(new Date(), "yyyy-MM-dd") },
      }),
    onSendToBacklog: () => promoteIdea.mutate({ id: idea.id }),
    onScheduleTomorrow: () =>
      promoteIdea.mutate({
        id: idea.id,
        input: { scheduledDate: format(addDays(new Date(), 1), "yyyy-MM-dd") },
      }),
    onScheduleNextWeek: () =>
      promoteIdea.mutate({
        id: idea.id,
        input: {
          scheduledDate: format(
            addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7),
            "yyyy-MM-dd"
          ),
        },
      }),
    onEdit: () => setEditOpen(true),
    onMoveToColumn: (columnId) =>
      updateIdea.mutate({ id: idea.id, input: { columnId } }),
    onDelete: () => deleteIdea.mutate(idea.id),
  };

  const cardInner = (
    <div
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={overlay ? undefined : handleClick}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg px-3 py-2.5 transition-all duration-200",
        "bg-card hover:bg-card/80",
        "border border-border/40 hover:border-border/60",
        "cursor-grab active:cursor-grabbing touch-none select-none",
        overlay &&
          "shadow-xl ring-2 ring-primary/20 rotate-[0.5deg] cursor-grabbing",
        isCompleted && "opacity-50 hover:opacity-60 bg-card/50"
      )}
    >
      {/* Main row: checkbox + title */}
      <div className="flex items-start gap-2">
        <div
          role="checkbox"
          aria-checked={isCompleted}
          onClick={toggleComplete}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "relative mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
            isCompleted
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
          )}
        >
          {isCompleted && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </div>

        <p
          className={cn(
            "min-w-0 flex-1 text-sm leading-snug text-foreground break-words line-clamp-3",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {idea.title}
        </p>
      </div>

      {/* Optional notes preview (rich text) */}
      {hasNotes && !isCompleted && (
        <HtmlContent
          html={idea.notes!}
          className="pl-6 text-xs leading-snug text-muted-foreground line-clamp-2 [&_p]:m-0"
        />
      )}

      {/* Meta row: subtasks + in-planner marker */}
      {(subtaskTotal > 0 || inPlanner) && !isCompleted && (
        <div className="flex items-center gap-3 pl-6">
          {subtaskTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
              <ListChecks className="h-3 w-3" />
              {subtaskDone}/{subtaskTotal}
            </span>
          )}
          {inPlanner && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              In planner
            </span>
          )}
        </div>
      )}

      {/* ⋯ menu — appears on hover */}
      {!overlay && (
        <div
          className={cn(
            "absolute right-1.5 top-1.5 transition-opacity",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Idea actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <IdeaMenuItems
                family={DROPDOWN_FAMILY}
                handlers={handlers}
                otherColumns={otherColumns}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  if (overlay) return cardInner;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{cardInner}</ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <IdeaMenuItems
            family={CONTEXT_FAMILY}
            handlers={handlers}
            otherColumns={otherColumns}
          />
        </ContextMenuContent>
      </ContextMenu>

      {editOpen && (
        <IdeaEditDialog
          boardId={boardId}
          idea={idea}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}
