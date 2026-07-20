import * as React from "react";
import { format, isSameDay } from "date-fns";
import type { TimeBlock } from "@open-sunsama/types";
import { cn } from "@/lib/utils";

interface ScheduleTextPanelProps {
  /** All time blocks for the visible range (panel filters to `date`) */
  timeBlocks: TimeBlock[];
  /** The single day being displayed */
  date: Date;
  className?: string;
}

/**
 * Right-side panel rendering the day's schedule as plain text — one
 * line per block: "7:35pm Meeting at the concert hall". Breaks are
 * schedule scaffolding, not events, so they're left out. Lines sort
 * from earliest to latest.
 */
export function ScheduleTextPanel({
  timeBlocks,
  date,
  className,
}: ScheduleTextPanelProps) {
  const lines = React.useMemo(() => {
    return timeBlocks
      .filter((block) => !block.isBreak)
      .filter((block) => isSameDay(new Date(block.startTime), date))
      .slice()
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      .map((block) => {
        const start = format(new Date(block.startTime), "h:mma").toLowerCase();
        return `${start} ${block.title}`;
      });
  }, [timeBlocks, date]);

  return (
    <div
      className={cn(
        "flex w-56 sm:w-64 flex-shrink-0 flex-col border-l bg-muted/20",
        className
      )}
    >
      <div className="border-b px-3 py-2">
        <h3 className="text-xs font-medium text-muted-foreground">Schedule</h3>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {lines.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground/60">
            No events scheduled.
          </p>
        ) : (
          <pre className="font-mono text-xs leading-6 text-foreground whitespace-pre-wrap break-words">
            {lines.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
