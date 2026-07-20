import * as React from "react";
import { format, isSameDay } from "date-fns";
import type { TimeBlock } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { getApi } from "@/lib/api";
import { useUpdateTimeBlock, useCreateTimeBlock } from "@/hooks";
import { Button } from "@/components/ui";

interface ScheduleTextPanelProps {
  timeBlocks: TimeBlock[];
  date: Date;
  className?: string;
}

const PANEL_WIDTH_KEY = "open_sunsama_schedule_panel_width";
const PANEL_TITLES_KEY = "open_sunsama_schedule_panel_titles";

function getStoredWidth(): number {
  if (typeof window === "undefined") return 256;
  return Number(window.localStorage.getItem(PANEL_WIDTH_KEY)) || 256;
}

function getStoredTitle(dateStr: string): string {
  if (typeof window === "undefined") return "";
  const m = JSON.parse(localStorage.getItem(PANEL_TITLES_KEY) || "{}");
  return m[dateStr] || "";
}

function storeTitle(dateStr: string, title: string): void {
  if (typeof window === "undefined") return;
  const m = JSON.parse(localStorage.getItem(PANEL_TITLES_KEY) || "{}");
  m[dateStr] = title;
  localStorage.setItem(PANEL_TITLES_KEY, JSON.stringify(m));
}

function linesFromBlocks(blocks: TimeBlock[]): string[] {
  return blocks
    .slice()
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map((b) => {
      const start = format(new Date(b.startTime), "h:mma").toLowerCase();
      return `${start} ${b.title}`;
    });
}

export function ScheduleTextPanel({
  timeBlocks,
  date,
  className,
}: ScheduleTextPanelProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const defaultTitle = `Schedule ${format(date, "MM/dd")}`;

  const [panelWidth, setPanelWidth] = React.useState(getStoredWidth);
  const [isDragging, setIsDragging] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [customTitle, setCustomTitle] = React.useState(() => getStoredTitle(dateStr));
  const [editingText, setEditingText] = React.useState(false);
  const [editLines, setEditLines] = React.useState("");
  const [translating, setTranslating] = React.useState(false);
  const updateTimeBlock = useUpdateTimeBlock();
  const createTimeBlock = useCreateTimeBlock();

  const dayBlocks = React.useMemo(() => {
    return timeBlocks.filter((b) => isSameDay(new Date(b.startTime), date) && !b.isBreak);
  }, [timeBlocks, date]);

  const lines = React.useMemo(() => linesFromBlocks(dayBlocks), [dayBlocks]);
  const displayTitle = customTitle || defaultTitle;

  // Persist title per-date
  React.useEffect(() => {
    if (customTitle) storeTitle(dateStr, customTitle);
  }, [customTitle, dateStr]);

  // Reset edit text when blocks change
  React.useEffect(() => {
    if (!editingText) {
      setEditLines(lines.join("\n"));
    }
  }, [lines, editingText]);

  // Sync editLines when opening editor
  const startEditing = React.useCallback(() => {
    setEditLines(lines.join("\n"));
    setEditingText(true);
  }, [lines]);

  // Handle update: parse lines → update blocks in order
  const handleUpdate = React.useCallback(async () => {
    const parsedLines = editLines.split("\n").filter(Boolean);
    const sortedBlocks = [...dayBlocks].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const timeRegex = /^(\d{1,2}):(\d{2})\s*(am|pm)?\s*/i;
    const updates: Array<{ id: string; title: string; startTime: Date; endTime: Date }> = [];

    for (let i = 0; i < Math.min(parsedLines.length, sortedBlocks.length); i++) {
      const line = parsedLines[i]!;
      const match = line.match(timeRegex);
      if (!match) continue;

      let hours = parseInt(match[1]!, 10);
      const minutes = parseInt(match[2]!, 10);
      const ampm = match[3]?.toLowerCase();

      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;

      const block = sortedBlocks[i]!;
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      const durationMins = Math.round(
        (blockEnd.getTime() - blockStart.getTime()) / 60000
      );

      const newStart = new Date(blockStart);
      newStart.setHours(hours, minutes, 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMins * 60000);

      // Extract title from line (everything after time prefix)
      const titlePart = line.replace(timeRegex, "").trim();
      const newTitle = titlePart || block.title;

      updates.push({ id: block.id, title: newTitle, startTime: newStart, endTime: newEnd });
    }

    if (updates.length === 0) return;

    try {
      await Promise.all(
        updates.map((u) =>
          updateTimeBlock.mutateAsync({
            id: u.id,
            data: { title: u.title, startTime: u.startTime, endTime: u.endTime },
          })
        )
      );
      setEditingText(false);
    } catch {
      // error handled by hook toast
    }
  }, [editLines, dayBlocks, updateTimeBlock]);

  // Drag separator for resizing
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const clamped = Math.max(180, Math.min(480, newWidth));
      setPanelWidth(clamped);
      localStorage.setItem(PANEL_WIDTH_KEY, String(clamped));
    };
    const handleUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  // Translate
  const handleCN1 = React.useCallback(async () => {
    setTranslating(true);
    try {
      const api = getApi();
      const fullText = lines.join("\n");
      if (!fullText) return;
      const translated = await api.translate(fullText, "zh-TW");
      // Append at bottom
      setEditLines(lines.join("\n") + "\n— cn —\n" + translated);
    } finally {
      setTranslating(false);
    }
  }, [lines]);

  const handleCN2 = React.useCallback(async () => {
    setTranslating(true);
    try {
      const api = getApi();
      const translatedLines = await Promise.all(
        lines.map(async (line) => {
          if (!line.trim()) return line;
          const translated = await api.translate(line, "zh-TW");
          return `${translated}\n${line}`;
        })
      );
      setEditLines(translatedLines.join("\n"));
    } finally {
      setTranslating(false);
    }
  }, [lines]);

  return (
    <div
      className={cn(
        "flex flex-shrink-0 flex-col border-l bg-muted/20 relative",
        className
      )}
      style={{ width: panelWidth }}
    >
      {/* Drag handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 z-10"
        onMouseDown={handleMouseDown}
      />

      {/* Title — click to edit */}
      <div className="border-b px-3 py-2">
        {editingTitle ? (
          <input
            autoFocus
            className="w-full text-xs font-medium bg-transparent border-b border-primary/50 outline-none"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditingTitle(false);
            }}
          />
        ) : (
          <h3
            className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
            onClick={() => setEditingTitle(true)}
            title="Click to edit title"
          >
            {displayTitle}
          </h3>
        )}
      </div>

      {/* Schedule text — editable */}
      <div className="flex-1 overflow-auto p-3">
        {editingText ? (
          <textarea
            autoFocus
            className="w-full h-full min-h-[200px] font-mono text-xs leading-6 bg-transparent border-none outline-none resize-none"
            value={editLines}
            onChange={(e) => setEditLines(e.target.value)}
          />
        ) : lines.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground/60">
            No events scheduled.
          </p>
        ) : (
          <pre
            className="font-mono text-xs leading-6 text-foreground whitespace-pre-wrap break-words cursor-pointer"
            onClick={startEditing}
          >
            {lines.join("\n")}
          </pre>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t px-3 py-2 space-y-2">
        {editingText && (
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleUpdate}
            disabled={updateTimeBlock.isPending}
          >
            {updateTimeBlock.isPending ? "Saving..." : "Update"}
          </Button>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-1.5 flex-1"
            onClick={handleCN1}
            disabled={translating || lines.length === 0}
            title="Add Chinese (TW) translation at bottom"
          >
            CN1
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-1.5 flex-1"
            onClick={handleCN2}
            disabled={translating || lines.length === 0}
            title="Add Chinese (TW) translation per line"
          >
            CN2
          </Button>
        </div>
      </div>
    </div>
  );
}
