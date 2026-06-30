import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Idea, IdeaColumn as IdeaColumnType } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Textarea,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui";
import {
  useCreateIdea,
  useDeleteIdeaColumn,
  useUpdateIdeaColumn,
} from "@/hooks/useIdeas";
import { IdeaCard } from "./idea-card";

interface IdeaColumnProps {
  boardId: string;
  column: IdeaColumnType;
  ideas: Idea[];
  allColumns: IdeaColumnType[];
  canDelete: boolean;
}

export function IdeaColumnView({
  boardId,
  column,
  ideas,
  allColumns,
  canDelete,
}: IdeaColumnProps) {
  const [composing, setComposing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(column.name);

  const createIdea = useCreateIdea(boardId);
  const updateColumn = useUpdateIdeaColumn(boardId);
  const deleteColumn = useDeleteIdeaColumn(boardId);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const ideaIds = React.useMemo(() => ideas.map((i) => i.id), [ideas]);

  const submitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    createIdea.mutate({
      boardId,
      columnId: column.id,
      title: trimmed,
    });
    setDraft(""); // keep composer open for rapid entry
  };

  const submitRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== column.name) {
      updateColumn.mutate({ id: column.id, input: { name: trimmed } });
    }
    setRenaming(false);
  };

  return (
    <section
      className={cn(
        "flex w-[272px] shrink-0 flex-col gap-2 rounded-xl border border-border/60 bg-muted/40 p-2.5 transition-colors",
        isOver && "border-primary/40 bg-primary/5"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        {renaming ? (
          <Input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setNameDraft(column.name);
                setRenaming(false);
              }
            }}
            className="h-7 text-[13px] font-semibold"
            maxLength={120}
          />
        ) : (
          <>
            <span className="text-[13px] font-semibold">{column.name}</span>
            <span className="grid h-[18px] min-w-[20px] place-items-center rounded-full border border-border/60 bg-background px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {ideas.length}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label="Column actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => {
                    setNameDraft(column.name);
                    setRenaming(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canDelete}
                  className={cn(
                    canDelete &&
                      "text-destructive focus:text-destructive focus:bg-destructive/10"
                  )}
                  onClick={() => canDelete && deleteColumn.mutate(column.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex min-h-[8px] flex-col gap-2 overflow-y-auto scrollbar-thin"
      >
        <SortableContext items={ideaIds} strategy={verticalListSortingStrategy}>
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              boardId={boardId}
              columns={allColumns}
            />
          ))}
        </SortableContext>

        {ideas.length === 0 && !composing && (
          <div className="rounded-lg border border-dashed border-border/60 px-2.5 py-4 text-center text-xs leading-relaxed text-muted-foreground">
            Drag cards here,
            <br />
            or add a new one
          </div>
        )}
      </div>

      {/* Inline add composer */}
      {composing ? (
        <div className="rounded-lg border border-ring bg-card p-2 shadow-sm ring-2 ring-ring/20">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitDraft();
              }
              if (e.key === "Escape") {
                setDraft("");
                setComposing(false);
              }
            }}
            placeholder="Idea title…"
            rows={2}
            className="min-h-[44px] resize-none border-none p-0 text-sm shadow-none focus-visible:ring-0"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" className="h-7" onClick={submitDraft}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                setDraft("");
                setComposing(false);
              }}
            >
              Cancel
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              ⏎ add · ⇧⏎ newline
            </span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add idea
        </button>
      )}
    </section>
  );
}
