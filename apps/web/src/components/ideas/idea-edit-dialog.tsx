import * as React from "react";
import type { Idea } from "@open-sunsama/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from "@/components/ui";
import { RichTextEditor } from "@/components/ui/rich-text-editor.lazy";
import { useUpdateIdea } from "@/hooks/useIdeas";

interface IdeaEditDialogProps {
  boardId: string;
  idea: Idea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await updateIdea.mutateAsync({
      id: idea.id,
      input: { title: trimmed, notes: notes.trim() ? notes.trim() : null },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit idea</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Idea title…"
              maxLength={500}
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Notes
              </Label>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Add details..."
                minHeight="80px"
              />
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || updateIdea.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
