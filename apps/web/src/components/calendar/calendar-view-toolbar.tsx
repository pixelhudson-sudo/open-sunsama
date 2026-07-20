import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Printer, ZoomIn, ZoomOut, PanelRightClose, PanelRightOpen, FileDown, Trash2, Undo2 } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui";
import type { TimeBlock, CalendarViewMode } from "@open-sunsama/types";
import { cn } from "@/lib/utils";

interface TemplateItem {
  id: string;
  name: string;
}

interface CalendarViewToolbarProps {
  selectedDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  timeBlocks: TimeBlock[];
  zoomPercent?: number;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  schedulePanelOpen?: boolean;
  onToggleSchedulePanel?: () => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onClearAll?: () => void;
  onPrintSchedule?: () => void;
  undoCount?: number;
  onUndo?: () => void;
  /** Template management */
  templates?: TemplateItem[];
  onSaveAsTemplate?: () => void;
  onLoadTemplate?: (id: string) => void;
  onRenameTemplate?: (id: string) => void;
  onDownloadTemplate?: (id: string) => void;
  onDeleteTemplate?: (id: string) => void;
  onOverwriteTemplate?: (id: string) => void;
  className?: string;
}

const VIEW_MODE_LABELS: Record<CalendarViewMode, string> = {
  hours: "Hours",
  day: "Day",
  "3-day": "3 days",
  week: "Week",
  month: "Month",
};

const VIEW_MODES: CalendarViewMode[] = ["hours", "day", "3-day", "week", "month"];

function describeRange(
  rangeStart: Date,
  rangeEnd: Date,
  viewMode: CalendarViewMode
): { primary: string; secondary: string } {
  if (viewMode === "day" || viewMode === "hours") {
    return {
      primary: format(rangeStart, "EEEE"),
      secondary: format(rangeStart, "MMM d, yyyy"),
    };
  }

  if (viewMode === "month") {
    return {
      primary: format(rangeStart, "MMMM"),
      secondary: format(rangeStart, "yyyy"),
    };
  }

  const sameMonth = rangeStart.getMonth() === rangeEnd.getMonth();
  const sameYear = rangeStart.getFullYear() === rangeEnd.getFullYear();

  let secondary: string;
  if (sameMonth && sameYear) {
    secondary = `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "d, yyyy")}`;
  } else if (sameYear) {
    secondary = `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}`;
  } else {
    secondary = `${format(rangeStart, "MMM d, yyyy")} – ${format(rangeEnd, "MMM d, yyyy")}`;
  }

  return {
    primary: viewMode === "week" ? "This week" : "3 days",
    secondary,
  };
}

export function CalendarViewToolbar({
  selectedDate: _selectedDate,
  rangeStart,
  rangeEnd,
  viewMode,
  onViewModeChange,
  timeBlocks,
  zoomPercent = 100,
  canZoomIn = true,
  canZoomOut = true,
  onZoomIn,
  onZoomOut,
  schedulePanelOpen = true,
  onToggleSchedulePanel,
  onPreviousDay,
  onNextDay,
  onToday,
  onClearAll,
  onPrintSchedule,
  undoCount = 0,
  onUndo,
  templates = [],
  onSaveAsTemplate,
  onLoadTemplate,
  onRenameTemplate,
  onDownloadTemplate,
  onDeleteTemplate,
  onOverwriteTemplate,
}: CalendarViewToolbarProps) {
  const today = new Date();
  const todayInRange = isWithinInterval(today, {
    start: startOfDay(rangeStart),
    end: endOfDay(rangeEnd),
  });
  const { primary, secondary } = describeRange(rangeStart, rangeEnd, viewMode);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b px-3 sm:px-4 py-2 sm:py-3 bg-background gap-2 sm:gap-4">
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
        {/* Date Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onPreviousDay}
            aria-label="Previous range"
            className="h-10 w-10 sm:h-9 sm:w-9"
          >
            <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant={todayInRange ? "default" : "outline"}
            onClick={onToday}
            className="min-w-[60px] sm:min-w-[70px] h-10 sm:h-9 text-sm"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextDay}
            aria-label="Next range"
            className="h-10 w-10 sm:h-9 sm:w-9"
          >
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Selected Range Display */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-muted-foreground hidden sm:block" />
          <div>
            <h2 className="text-base sm:text-lg font-semibold leading-none">
              {primary}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {secondary}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-between sm:justify-end">
        {/* View mode selector */}
        <div
          className="inline-flex items-center rounded-md border border-border/50 bg-muted/30 p-0.5"
          role="tablist"
          aria-label="Calendar view"
        >
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "px-2.5 sm:px-3 h-7 sm:h-8 rounded text-xs sm:text-[13px] font-medium transition-colors",
                viewMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {VIEW_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Hours-view zoom controls */}
        {viewMode === "hours" && (
          <div className="inline-flex items-center rounded-md border border-border/50 bg-muted/30 p-0.5">
            <button
              onClick={onZoomOut}
              disabled={!canZoomOut}
              aria-label="Zoom out (-)"
              title="Zoom out (-)"
              className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[44px] text-center text-xs tabular-nums text-muted-foreground">
              {zoomPercent}%
            </span>
            <button
              onClick={onZoomIn}
              disabled={!canZoomIn}
              aria-label="Zoom in (+)"
              title="Zoom in (+)"
              className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Hours-view schedule panel toggle */}
        {viewMode === "hours" && onToggleSchedulePanel && (
          <Button
            variant={schedulePanelOpen ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleSchedulePanel}
            aria-label={schedulePanelOpen ? "Hide schedule panel" : "Show schedule panel"}
            title={schedulePanelOpen ? "Hide schedule panel" : "Show schedule panel"}
            className="h-9 px-2.5 text-xs gap-1.5"
          >
            {schedulePanelOpen ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Schedule</span>
          </Button>
        )}

        {/* Block count badge */}
        {(viewMode === "day" || viewMode === "hours") &&
          timeBlocks.filter((b) => !b.isBreak).length > 0 && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {timeBlocks.filter((b) => !b.isBreak).length} block
            {timeBlocks.filter((b) => !b.isBreak).length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Templates + Clear all + Print */}
        <div className="flex items-center gap-1">
          {/* Templates dialog — shown in hours/day views */}
          {(viewMode === "hours" || viewMode === "day") && onSaveAsTemplate && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-xs gap-1.5"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Templates</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle>Templates</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={onSaveAsTemplate}
                  >
                    Save current schedule as template…
                  </Button>
                  {templates.length > 0 && (
                    <>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2 pb-1">
                        {templates.length} template{templates.length !== 1 ? "s" : ""}
                      </div>
                      <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {[...templates]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted/50"
                            >
                              <span
                                className="flex-1 cursor-pointer font-medium truncate"
                                onClick={(e) => { e.stopPropagation(); onLoadTemplate?.(t.id); }}
                                title="Click to load"
                              >
                                {t.name}
                              </span>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  className="px-1.5 py-0.5 rounded text-[10px] hover:bg-muted text-muted-foreground"
                                  onClick={() => onLoadTemplate?.(t.id)}
                                  title="Load"
                                >
                                  Load
                                </button>
                                <button
                                  className="px-1.5 py-0.5 rounded text-[10px] hover:bg-muted text-muted-foreground"
                                  onClick={() => onRenameTemplate?.(t.id)}
                                  title="Rename"
                                >
                                  Rename
                                </button>
                                <button
                                  className="px-1.5 py-0.5 rounded text-[10px] hover:bg-muted text-muted-foreground"
                                  onClick={() => onOverwriteTemplate?.(t.id)}
                                  title="Overwrite"
                                >
                                  Overwrite
                                </button>
                                <button
                                  className="px-1.5 py-0.5 rounded text-[10px] hover:bg-destructive/10 text-destructive"
                                  onClick={() => onDeleteTemplate?.(t.id)}
                                  title="Delete"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Clear all blocks */}
          {onClearAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              aria-label="Clear all blocks"
              className="h-9 px-2.5 text-xs gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear all</span>
            </Button>
          )}

          {/* Undo button with count */}
          {undoCount > 0 && onUndo && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              aria-label={`Undo (${undoCount} available)`}
              className="h-9 px-2.5 text-xs gap-1.5"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
              <span className="text-[10px] text-muted-foreground">({undoCount})</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onPrintSchedule}
            aria-label="Print schedule"
            className="h-9 px-2.5 text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
