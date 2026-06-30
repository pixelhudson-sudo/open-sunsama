import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, Loader2 } from "lucide-react";
import type { Idea, IdeaColumn } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui";
import {
  useIdeaColumns,
  useIdeas,
  useReorderIdeas,
  useCreateIdeaColumn,
} from "@/hooks/useIdeas";
import { IdeaColumnView } from "./idea-column";
import { IdeaCard } from "./idea-card";

interface IdeasBoardViewProps {
  boardId: string;
}

function sortByPosition(a: Idea, b: Idea) {
  return a.position - b.position || (a.createdAt < b.createdAt ? -1 : 1);
}

export function IdeasBoardView({ boardId }: IdeasBoardViewProps) {
  const { data: columns, isLoading: columnsLoading } = useIdeaColumns(boardId);
  const { data: ideas, isLoading: ideasLoading } = useIdeas(boardId);
  const reorderIdeas = useReorderIdeas(boardId);
  const createColumn = useCreateIdeaColumn();

  const [activeIdea, setActiveIdea] = React.useState<Idea | null>(null);
  const [addingColumn, setAddingColumn] = React.useState(false);
  const [columnDraft, setColumnDraft] = React.useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group ideas by column, each sorted by position.
  const ideasByColumn = React.useMemo(() => {
    const map = new Map<string, Idea[]>();
    for (const col of columns ?? []) map.set(col.id, []);
    for (const idea of ideas ?? []) {
      const list = map.get(idea.columnId);
      if (list) list.push(idea);
    }
    for (const list of map.values()) list.sort(sortByPosition);
    return map;
  }, [columns, ideas]);

  const sortedColumns = React.useMemo(
    () => [...(columns ?? [])].sort((a, b) => a.position - b.position),
    [columns]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "idea") setActiveIdea(data.idea as Idea);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIdea(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    if (activeData?.type !== "idea") return;
    const dragged = activeData.idea as Idea;

    // Resolve destination column from whatever we dropped on.
    const overData = over.data.current;
    const destColumnId =
      overData?.type === "idea"
        ? (overData.columnId as string)
        : (over.id as string);
    if (!destColumnId) return;

    const sourceColumnId = dragged.columnId;
    const destIdeas = (ideasByColumn.get(destColumnId) ?? []).filter(
      (i) => i.id !== dragged.id
    );

    // Index to insert at: position of the card we hovered, else end.
    let insertIndex = destIdeas.length;
    if (overData?.type === "idea") {
      const overIndex = destIdeas.findIndex((i) => i.id === over.id);
      if (overIndex !== -1) insertIndex = overIndex;
    }

    const nextIds = destIdeas.map((i) => i.id);
    nextIds.splice(insertIndex, 0, dragged.id);

    // No-op guard: same column, same order.
    if (sourceColumnId === destColumnId) {
      const current = (ideasByColumn.get(destColumnId) ?? []).map((i) => i.id);
      if (current.length === nextIds.length &&
        current.every((id, idx) => id === nextIds[idx])) {
        return;
      }
    }

    reorderIdeas.mutate({ columnId: destColumnId, ideaIds: nextIds });
  };

  const submitColumn = () => {
    const trimmed = columnDraft.trim();
    if (!trimmed) return;
    createColumn.mutate({ boardId, name: trimmed });
    setColumnDraft("");
    setAddingColumn(false);
  };

  if (columnsLoading || ideasLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveIdea(null)}
    >
      <div className="flex flex-1 items-start gap-3.5 overflow-x-auto p-4">
        {sortedColumns.map((column: IdeaColumn) => (
          <IdeaColumnView
            key={column.id}
            boardId={boardId}
            column={column}
            ideas={ideasByColumn.get(column.id) ?? []}
            allColumns={sortedColumns}
            canDelete={sortedColumns.length > 1}
          />
        ))}

        {/* Add column */}
        {addingColumn ? (
          <div className="w-[272px] shrink-0 rounded-xl border border-border/60 bg-muted/40 p-2.5">
            <Input
              autoFocus
              value={columnDraft}
              onChange={(e) => setColumnDraft(e.target.value)}
              onBlur={submitColumn}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitColumn();
                if (e.key === "Escape") {
                  setColumnDraft("");
                  setAddingColumn(false);
                }
              }}
              placeholder="Column name…"
              className="h-8 text-[13px]"
              maxLength={120}
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingColumn(true)}
            className={cn(
              "flex w-[272px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-border/60 bg-transparent p-3 text-[13px] text-muted-foreground transition-colors",
              "hover:border-muted-foreground/50 hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Plus className="h-4 w-4" />
            Add column
          </button>
        )}
      </div>

      <DragOverlay>
        {activeIdea ? (
          <div className="w-[252px]">
            <IdeaCard
              idea={activeIdea}
              boardId={boardId}
              columns={sortedColumns}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
