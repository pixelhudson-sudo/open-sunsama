import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, addDays } from "date-fns";
import {
  Check,
  MoreHorizontal,
  ArrowRight,
  Calendar,
  Pencil,
  Columns3,
  Trash2,
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

/**
 * An idea card. Visually the same component as the kanban task card
 * (task-card-content.tsx): circle checkbox + title + optional muted note,
 * with the ⋯ menu mirroring task-context-menu, adapted for Ideas.
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
  // Notes are rich-text HTML; only show a preview when there's real text.
  const hasNotes =
    !!idea.notes && idea.notes.replace(/<[^>]*>/g, "").trim().length > 0;

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

  // Click the card to edit — but not at the tail of a drag.
  const handleClick = () => {
    if (!sortable.isDragging) setEditOpen(true);
  };

  const otherColumns = columns.filter((c) => c.id !== idea.columnId);

  return (
    <>
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

        {/* "In backlog" marker once promoted */}
        {inPlanner && (
          <div className="flex items-center gap-1 pl-6">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              In planner
            </span>
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
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => promoteIdea.mutate({ id: idea.id })}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Send to backlog
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() =>
                        promoteIdea.mutate({
                          id: idea.id,
                          input: {
                            scheduledDate: format(new Date(), "yyyy-MM-dd"),
                          },
                        })
                      }
                    >
                      Today
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        promoteIdea.mutate({
                          id: idea.id,
                          input: {
                            scheduledDate: format(
                              addDays(new Date(), 1),
                              "yyyy-MM-dd"
                            ),
                          },
                        })
                      }
                    >
                      Tomorrow
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {otherColumns.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Columns3 className="mr-2 h-4 w-4" />
                      Move to column
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {otherColumns.map((col) => (
                        <DropdownMenuItem
                          key={col.id}
                          onClick={() =>
                            updateIdea.mutate({
                              id: idea.id,
                              input: { columnId: col.id },
                            })
                          }
                        >
                          {col.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={() => deleteIdea.mutate(idea.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

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
