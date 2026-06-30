import * as React from "react";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { IdeaBoard } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui";
import { useDeleteIdeaBoard } from "@/hooks/useIdeas";
import { BoardIcon } from "./board-icon";
import { BoardDialog } from "./board-dialog";

interface BoardRailContentProps {
  boards: IdeaBoard[];
  activeBoardId: string | null;
  onSelect: (boardId: string) => void;
  onNewBoard: () => void;
  /** Icon-only mode (desktop collapsed rail). */
  collapsed?: boolean;
}

export function BoardRailContent({
  boards,
  activeBoardId,
  onSelect,
  onNewBoard,
  collapsed,
}: BoardRailContentProps) {
  const [editing, setEditing] = React.useState<IdeaBoard | null>(null);
  const deleteBoard = useDeleteIdeaBoard();

  return (
    <>
      <div className="flex flex-col gap-0.5">
        {boards.map((board) => {
          const isActive = board.id === activeBoardId;
          return (
            <div
              key={board.id}
              className={cn(
                "group relative flex cursor-pointer items-center gap-2.5 rounded-lg text-[13.5px] transition-colors",
                collapsed ? "h-9 w-9 justify-center" : "px-2 py-1.5",
                isActive
                  ? "bg-muted font-semibold"
                  : "hover:bg-muted text-foreground"
              )}
              onClick={() => onSelect(board.id)}
              title={collapsed ? board.name : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
              )}
              <BoardIcon icon={board.icon} color={board.color} size={22} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{board.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                        aria-label="Board actions"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                      className="w-40"
                    >
                      <DropdownMenuItem onClick={() => setEditing(board)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete “${board.name}” and all its ideas?`
                            )
                          ) {
                            deleteBoard.mutate(board.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          );
        })}
      </div>

      {!collapsed && (
        <>
          <div className="my-2 h-px bg-border" />
          <button
            onClick={onNewBoard}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-[15px] w-[15px]" />
            New board
          </button>
        </>
      )}

      {editing && (
        <BoardDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          board={editing}
        />
      )}
    </>
  );
}
