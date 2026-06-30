import * as React from "react";
import { Check } from "lucide-react";
import type { Idea } from "@open-sunsama/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Label,
} from "@/components/ui";
import { RichTextEditor } from "@/components/ui/rich-text-editor.lazy";
import { cn } from "@/lib/utils";
import { useUpdateIdea } from "@/hooks/useIdeas";
import { IdeaSubtaskList } from "./idea-subtask-list";

interface IdeaEditDialogProps {
  boardId: string;
  idea: Idea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Idea editor — a richer, mostly-live editor that mirrors the task modal:
 * completion checkbox + title (saved on blur), live subtasks, and rich
 * notes (saved on close).
 */
export function IdeaEditDialog({
  boardId,
  idea,
  open,
  onOpenChange,
}: IdeaEditDialogProps) {
  const [title, setTitle] = React.useState(idea.title);
  const [notes, setNotes] = React.useState(idea.notes ?? "");
  const updateIdea = useUpdateIdea(boardId);

  React.useEffect(() => {
    if (open) {
      setTitle(idea.title);
      setNotes(idea.notes ?? "");
    }
  }, [open, idea]);

  const isCompleted = !!idea.completedAt;

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(idea.title);
      return;
    }
    if (trimmed !== idea.title) {
      updateIdea.mutate({ id: idea.id, input: { title: trimmed } });
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Persist notes on close.
      const cleaned = notes.replace(/<[^>]*>/g, "").trim().length ? notes : "";
      if (cleaned !== (idea.notes ?? "")) {
        updateIdea.mutate({
          id: idea.id,
          input: { notes: cleaned || null },
        });
      }
    }
    onOpenChange(next);
  };

  const toggleComplete = () => {
    updateIdea.mutate({
      id: idea.id,
      input: { completedAt: isCompleted ? null : new Date() },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Edit idea</DialogTitle>

        {/* Header: checkbox + title */}
        <div className="flex items-start gap-3 px-5 pb-3 pt-5">
          <button
            type="button"
            onClick={toggleComplete}
            aria-checked={isCompleted}
            role="checkbox"
            className={cn(
              "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
              isCompleted
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 hover:border-primary"
            )}
          >
            {isCompleted && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            rows={1}
            placeholder="Idea title"
            className={cn(
              "mt-0.5 min-w-0 flex-1 resize-none border-none bg-transparent p-0 pr-6 text-lg font-semibold outline-none focus:ring-0",
              isCompleted && "text-muted-foreground line-through"
            )}
          />
        </div>

        {/* Body: subtasks + notes */}
        <div className="max-h-[60vh] space-y-4 overflow-y-auto border-t border-border/40 px-5 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subtasks
            </Label>
            <IdeaSubtaskList ideaId={idea.id} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </Label>
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              placeholder="Add details..."
              minHeight="120px"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
