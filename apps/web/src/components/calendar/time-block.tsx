import * as React from "react";
import { format, differenceInMinutes } from "date-fns";
import type { TimeBlock as TimeBlockType } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import {
  calculateYFromTime,
  HOUR_HEIGHT,
} from "@/hooks/useCalendarDnd";
import { TimeBlockContextMenu } from "./time-block-context-menu";
import type { LayoutResult } from "./event-layout";
import { X } from "lucide-react";

const COLUMN_GAP_PCT = 1; // gap between side-by-side overlapping items

interface TimeBlockProps {
  block: TimeBlockType;
  /** Pixels per hour — hours-view zoom level (defaults to HOUR_HEIGHT) */
  hourHeight?: number;
  /**
   * Lane assignment from the side-by-side overlap layout. When N items
   * overlap at the same time slot, they split the column into N
   * sub-columns and each item renders in its assigned lane.
   */
  layout?: LayoutResult;
  onClick?: () => void;
  onEditBlock?: () => void;
  onDelete?: (blockId: string) => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, edge: "top" | "bottom") => void;
  /** Click the bottom resize handle → open quick-create popup */
  onEndClick?: () => void;
  onViewTask?: (taskId: string) => void;
  isSelected?: boolean;
  isDragging?: boolean;
  className?: string;
}

/**
 * Convert hex color to rgba string
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");
  
  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get color classes based on task status or custom color
 * Returns semi-transparent backgrounds for a clean Sunsama-like look
 */
function getBlockColors(block: TimeBlockType): {
  bg: string;
  border: string;
  text: string;
  textMuted: string;
} {
  // Default blue color
  const baseColor = block.color || "#3B82F6";
  
  return {
    bg: hexToRgba(baseColor, 0.15),
    border: hexToRgba(baseColor, 0.6),
    text: "inherit", // Use foreground color
    textMuted: "inherit", // Use muted-foreground via class
  };
}

/**
 * TimeBlock component for displaying scheduled time blocks on the timeline
 */
export function TimeBlock({
  block,
  hourHeight = HOUR_HEIGHT,
  layout = { lane: 0, columnCount: 1 },
  onClick,
  onEditBlock,
  onDelete,
  onDragStart,
  onResizeStart,
  onEndClick,
  onViewTask,
  isSelected = false,
  isDragging = false,
  className,
}: TimeBlockProps) {
  const startTime = new Date(block.startTime);
  const endTime = new Date(block.endTime);

  // Calculate position and size
  const top = calculateYFromTime(startTime, hourHeight);
  const durationMins = differenceInMinutes(endTime, startTime);
  const height = (durationMins / 60) * hourHeight;

  // Get colors
  const colors = getBlockColors(block);

  // Determine if block is too short to show full content
  const isCompact = height < 48;

  // Duration lock: resize handles are hidden (moves still preserve
  // duration, so dragging stays enabled).
  const canResize = !block.isDurationLocked;

  // Display fallback title for empty break blocks
  const displayTitle = block.title || (block.isBreak ? "Break" : "Untitled");

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag if clicking on resize handles
    if ((e.target as HTMLElement).dataset.resize) {
      return;
    }
    onDragStart?.(e);
  };

  const handleTopResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    onResizeStart?.(e, "top");
  };

  const handleBottomResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    onResizeStart?.(e, "bottom");
  };

  return (
    <TimeBlockContextMenu
      timeBlock={block}
      onEdit={onClick}
      onEditBlock={onEditBlock}
      onViewTask={onViewTask}
    >
      <div
        data-time-block
        className={cn(
          "group absolute z-10 my-0.5 rounded-md border-l-[3px] transition-all select-none",
          "hover:brightness-95 hover:z-20",
          isSelected && "ring-2 ring-primary ring-offset-1",
          isDragging && "opacity-50 cursor-grabbing",
          !isDragging && "cursor-grab",
          // Breaks read as schedule scaffolding, not work blocks:
          // dashed edge + muted fill.
          block.isBreak && "border-dashed opacity-70",
          className
        )}
        style={{
          top: `${top}px`,
          height: `${Math.max(height - 4, 4)}px`,
          left: `calc(${(100 / layout.columnCount) * layout.lane}% + ${layout.lane === 0 ? "4px" : "1px"})`,
          width: `calc(${100 / layout.columnCount - COLUMN_GAP_PCT}% - ${layout.lane === 0 ? "4px" : "1px"})`,
          backgroundColor: colors.bg,
          borderColor: colors.border,
        }}
        onClick={onClick}
        onMouseDown={handleMouseDown}
        role="button"
        tabIndex={0}
        aria-label={`Time block: ${displayTitle} from ${format(startTime, "h:mm a")} to ${format(endTime, "h:mm a")}`}
      >
        {/* Top resize handle - Larger touch target on mobile (hidden when duration-locked) */}
        {canResize && (
          <div
            data-resize="top"
            className={cn(
              "absolute top-0 left-0 right-0 cursor-ns-resize hover:bg-black/10 rounded-t-sm",
              "h-3 sm:h-2",
              "-mt-1 sm:mt-0"
            )}
            onMouseDown={handleTopResize}
          />
        )}

        {/* Delete button — top-right, visible on hover */}
        {onDelete && (
          <button
            className="absolute top-0.5 right-0.5 z-20 h-4 w-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-60 hover:opacity-100 bg-black/20 hover:bg-black/40 text-white transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete "${displayTitle}"?`)) {
                onDelete(block.id);
              }
            }}
            title={`Delete ${displayTitle}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Content */}
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden px-2",
            isCompact ? "py-0.5" : "py-1"
          )}
        >
          {/* Title - hidden for break blocks */}
          <p className={cn(
            "truncate font-medium text-foreground",
            isCompact ? "text-xs" : "text-sm",
            block.isBreak && "invisible"
          )}>
            {displayTitle}
          </p>

          {/* Time range - muted text, hide if too compact */}
          {!isCompact && (
            <p className="truncate text-xs text-muted-foreground">
              {format(startTime, "h:mm")} - {format(endTime, "h:mm a")}
            </p>
          )}
        </div>

        {/* Bottom resize handle — click opens quick-create popup */}
        {canResize && (
          <div
            data-resize="bottom"
            className={cn(
              "absolute bottom-0 left-0 right-0 cursor-ns-resize hover:bg-black/10 rounded-b-sm",
              "h-3 sm:h-2",
              "-mb-1 sm:mb-0"
            )}
            onMouseDown={handleBottomResize}
            onClick={(e) => {
              e.stopPropagation();
              onEndClick?.();
            }}
          />
        )}
      </div>
    </TimeBlockContextMenu>
  );
}

/**
 * TimeBlockPreview - Ghost preview shown while dragging
 */
interface TimeBlockPreviewProps {
  title: string;
  startTime: Date;
  endTime: Date;
  top: number;
  height: number;
  color?: string;
}

export function TimeBlockPreview({
  title,
  startTime,
  endTime,
  top,
  height,
  color,
}: TimeBlockPreviewProps) {
  const baseColor = color || "#3B82F6";
  
  return (
    <div
      className="absolute left-1 right-1 z-30 my-0.5 rounded-md border-2 border-dashed pointer-events-none"
      style={{
        top: `${top}px`,
        height: `${Math.max(height - 4, 20)}px`,
        borderColor: hexToRgba(baseColor, 0.6),
        backgroundColor: hexToRgba(baseColor, 0.2),
      }}
    >
      <div className="flex h-full flex-col overflow-hidden px-2 py-1">
        <p className="truncate text-sm font-medium text-foreground">
          {title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {format(startTime, "h:mm")} - {format(endTime, "h:mm a")}
        </p>
      </div>
    </div>
  );
}
