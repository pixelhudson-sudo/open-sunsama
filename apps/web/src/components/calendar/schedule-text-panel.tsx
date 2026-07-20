import * as React from "react";
import { format, isSameDay } from "date-fns";
import type { TimeBlock } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { getApi } from "@/lib/api";
import { useUpdateTimeBlock, useCascadeResizeTimeBlock } from "@/hooks";
import { Button, Input, Label } from "@/components/ui";

interface ScheduleTextPanelProps {
  timeBlocks: TimeBlock[];
  date: Date;
  className?: string;
}

const PANEL_WIDTH_KEY = "open_sunsama_schedule_panel_width";
const PANEL_TITLES_KEY = "open_sunsama_schedule_panel_titles";
const FONT_FAMILY_KEY = "open_sunsama_schedule_panel_font";
const FONT_SIZE_KEY = "open_sunsama_schedule_panel_font_size";

const FONT_OPTIONS = [
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  { label: "Sans", value: "ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
];

const FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 15, 16];

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

function getStoredFontFamily(): string {
  if (typeof window === "undefined") return FONT_OPTIONS[0]!.value;
  return localStorage.getItem(FONT_FAMILY_KEY) || FONT_OPTIONS[0]!.value;
}

function getStoredFontSize(): number {
  if (typeof window === "undefined") return 12;
  return Number(localStorage.getItem(FONT_SIZE_KEY)) || 12;
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
  const [fontFamily, setFontFamily] = React.useState(getStoredFontFamily);
  const [fontSize, setFontSize] = React.useState(getStoredFontSize);
  const [finalMessage, setFinalMessage] = React.useState("");
  const updateTimeBlock = useUpdateTimeBlock();
  const cascadeResizeTimeBlock = useCascadeResizeTimeBlock();

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

  // Handle update: parse lines, cascade first changed block, update titles
  const handleUpdate = React.useCallback(async () => {
    const parsedLines = editLines.split("\n").filter(Boolean);
    const sortedBlocks = [...dayBlocks].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const timeRegex = /^(\d{1,2}):(\d{2})\s*(am|pm)?\s*/i;
    const titleUpdates: Array<{ id: string; title: string }> = [];
    let firstCascadeId: string | null = null;
    let cascadeStart: Date | null = null;
    let cascadeEnd: Date | null = null;

    for (let i = 0; i < Math.min(parsedLines.length, sortedBlocks.length); i++) {
      const line = parsedLines[i]!;
      const block = sortedBlocks[i]!;

      // Extract title (everything after time prefix)
      const titlePart = line.replace(timeRegex, "").trim();
      const newTitle = titlePart || block.title;
      if (newTitle !== block.title) {
        titleUpdates.push({ id: block.id, title: newTitle });
      }

      // Check if the line has a new time
      const match = line.match(timeRegex);
      if (!match) continue;

      let hours = parseInt(match[1]!, 10);
      const minutes = parseInt(match[2]!, 10);
      const ampm = match[3]?.toLowerCase();

      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;

      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      const durationMins = Math.round(
        (blockEnd.getTime() - blockStart.getTime()) / 60000
      );

      const newStart = new Date(blockStart);
      newStart.setHours(hours, minutes, 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMins * 60000);

      // If this is the first block with a changed start time, cascade
      if (
        !firstCascadeId &&
        newStart.getTime() !== blockStart.getTime()
      ) {
        firstCascadeId = block.id;
        cascadeStart = newStart;
        cascadeEnd = newEnd;
      }
    }

    try {
      // First cascade the first changed block (shifts all downstream)
      if (firstCascadeId && cascadeStart && cascadeEnd) {
        await cascadeResizeTimeBlock.mutateAsync({
          id: firstCascadeId,
          startTime: cascadeStart,
          endTime: cascadeEnd,
          mode: 'all-downstream',
        });
      }

      // Then update any titles that changed
      if (titleUpdates.length > 0) {
        await Promise.all(
          titleUpdates.map((u) =>
            updateTimeBlock.mutateAsync({
              id: u.id,
              data: { title: u.title },
            })
          )
        );
      }

      setEditingText(false);
    } catch {
      // error handled by hook toast
    }
  }, [editLines, dayBlocks, updateTimeBlock, cascadeResizeTimeBlock]);

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

  // Translate — renders into final message box
  const handleCN1 = React.useCallback(async () => {
    setTranslating(true);
    try {
      const api = getApi();
      const fullText = lines.join("\n");
      if (!fullText) return;
      const translated = await api.translate(fullText, "zh-TW");
      setFinalMessage(fullText + "\n— cn —\n" + translated);
    } finally {
      setTranslating(false);
    }
  }, [lines]);

  const handleCN2 = React.useCallback(async () => {
    setTranslating(true);
    try {
      const api = getApi();
      const timeRegex = /^(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*/i;
      const translatedLines = await Promise.all(
        lines.map(async (line) => {
          if (!line.trim()) return line;
          const match = line.match(timeRegex);
          const timePrefix = match?.[1] ?? "";
          const titlePart = line.replace(timeRegex, "").trim();
          const translated = await api.translate(titlePart || line, "zh-TW");
          return `${timePrefix} ${translated} ${titlePart || ""}`.trim();
        })
      );
      setFinalMessage(translatedLines.join("\n"));
    } finally {
      setTranslating(false);
    }
  }, [lines]);

  // EN button: copy title + schedule to clipboard
  const handleEN = React.useCallback(() => {
    const text = displayTitle + "\n" + lines.join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }, [displayTitle, lines]);

  // COPY button: copy final message to clipboard
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(finalMessage).catch(() => {});
  }, [finalMessage]);

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

      {/* Font controls */}
      <div className="border-b px-3 py-1.5 flex items-center gap-2">
        <select
          className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 w-14"
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value);
            localStorage.setItem(FONT_FAMILY_KEY, e.target.value);
          }}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 w-12"
          value={fontSize}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFontSize(v);
            localStorage.setItem(FONT_SIZE_KEY, String(v));
          }}
        >
          {FONT_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </div>

      {/* Schedule text — editable */}
      <div className="flex-1 overflow-auto p-3">
        {editingText ? (
          <textarea
            autoFocus
            className="w-full h-full min-h-[200px] bg-transparent border-none outline-none resize-none leading-6"
            style={{ fontFamily, fontSize }}
            value={editLines}
            onChange={(e) => setEditLines(e.target.value)}
          />
        ) : lines.length === 0 ? (
          <p
            className="text-muted-foreground/60"
            style={{ fontFamily, fontSize }}
          >
            No events scheduled.
          </p>
        ) : (
          <pre
            className="text-foreground whitespace-pre-wrap break-words cursor-pointer leading-6"
            style={{ fontFamily, fontSize }}
            onClick={startEditing}
          >
            {lines.join("\n")}
          </pre>
        )}
      </div>

      {/* Final message box */}
      <div className="border-t px-3 py-2">
        <Label className="text-[10px] text-muted-foreground">Final message</Label>
        <textarea
          className="w-full h-20 text-xs bg-transparent border border-border rounded px-2 py-1 resize-none mt-1"
          style={{ fontFamily, fontSize}}
          value={finalMessage}
          onChange={(e) => setFinalMessage(e.target.value)}
          placeholder="CN1/CN2 output appears here..."
        />
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
            title="Translate full schedule, append at bottom"
          >
            CN1
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-1.5 flex-1"
            onClick={handleCN2}
            disabled={translating || lines.length === 0}
            title="Translate each line, prefix before original"
          >
            CN2
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-1.5"
            onClick={handleCopy}
            disabled={!finalMessage}
            title="Copy final message"
          >
            COPY
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-1.5"
            onClick={handleEN}
            title="Copy title + schedule"
          >
            EN
          </Button>
        </div>
      </div>
    </div>
  );
}
