import * as React from "react";
import { format, isSameDay } from "date-fns";
import type { TimeBlock } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { getApi } from "@/lib/api";
import { useUpdateTimeBlock, useCascadeResizeTimeBlock } from "@/hooks";
import { toast } from "@/hooks/use-toast";
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
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Palatino", value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, 'Segoe UI', sans-serif" },
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

  const timeRegex = /^(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*/i;

const FINAL_MSG_HEIGHT_KEY = "open_sunsama_final_msg_height";

function getStoredFinalMsgHeight(): number {
  if (typeof window === "undefined") return 120;
  return Number(window.localStorage.getItem(FINAL_MSG_HEIGHT_KEY)) || 120;
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
  const [finalMsgHeight, setFinalMsgHeight] = React.useState(getStoredFinalMsgHeight);
  const [convertSource, setConvertSource] = React.useState("");
  const [convertResult, setConvertResult] = React.useState("");
  const [draggingMsgHeight, setDraggingMsgHeight] = React.useState(false);
  const updateTimeBlock = useUpdateTimeBlock();
  const cascadeResizeTimeBlock = useCascadeResizeTimeBlock();

  const dayBlocks = React.useMemo(() => {
    return timeBlocks.filter((b) => isSameDay(new Date(b.startTime), date) && !b.isBreak);
  }, [timeBlocks, date]);

  const lines = React.useMemo(() => linesFromBlocks(dayBlocks), [dayBlocks]);
  const displayTitle = customTitle || defaultTitle;

  React.useEffect(() => {
    if (customTitle) storeTitle(dateStr, customTitle);
  }, [customTitle, dateStr]);

  React.useEffect(() => {
    if (!editingText) {
      setEditLines(lines.join("\n"));
    }
  }, [lines, editingText]);

  const startEditing = React.useCallback(() => {
    setEditLines(lines.join("\n"));
    setEditingText(true);
  }, [lines]);

  // Handle update: cascade first changed block, update titles
  const handleUpdate = React.useCallback(async () => {
    const parsedLines = editLines.split("\n").filter(Boolean);
    const sortedBlocks = [...dayBlocks].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const titleUpdates: Array<{ id: string; title: string }> = [];
    let firstCascadeId: string | null = null;
    let cascadeStart: Date | null = null;
    let cascadeEnd: Date | null = null;

    for (let i = 0; i < Math.min(parsedLines.length, sortedBlocks.length); i++) {
      const line = parsedLines[i]!;
      const block = sortedBlocks[i]!;

      const titlePart = line.replace(timeRegex, "").trim();
      const newTitle = titlePart || block.title;
      if (newTitle !== block.title) {
        titleUpdates.push({ id: block.id, title: newTitle });
      }

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

      if (!firstCascadeId && newStart.getTime() !== blockStart.getTime()) {
        firstCascadeId = block.id;
        cascadeStart = newStart;
        cascadeEnd = newEnd;
      }
    }

    try {
      if (firstCascadeId && cascadeStart && cascadeEnd) {
        await cascadeResizeTimeBlock.mutateAsync({
          id: firstCascadeId,
          startTime: cascadeStart,
          endTime: cascadeEnd,
          mode: 'all-downstream',
        });
      }
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

  // Drag separator
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

  // Translate title helper
  const translateTitle = React.useCallback(async (api: ReturnType<typeof getApi>, title: string) => {
    try {
      return await api.translate(title, "zh-TW");
    } catch {
      return title;
    }
  }, []);

  // EN — display English-only schedule in final message box
  const handleEN = React.useCallback(() => {
    setFinalMessage(`${displayTitle}\n\n${lines.join("\n")}`);
  }, [displayTitle, lines]);

  // CN1 — title (orig + trans) + original + blank + translated
  const handleCN1 = React.useCallback(async () => {
    setTranslating(true);
    try {
      const api = getApi();
      const translatedTitle = await translateTitle(api, displayTitle);
      const fullText = lines.join("\n");
      if (!fullText) return;
      const translated = await api.translate(fullText, "zh-TW");
      setFinalMessage(`${displayTitle} ${translatedTitle}\n\n${fullText}\n\n${translated}`);
    } finally {
      setTranslating(false);
    }
  }, [lines, displayTitle, translateTitle]);

  // CN2 — translated title + per-line: timePrefix translatedTitle originalTitle
  const handleCN2 = React.useCallback(async () => {
    setTranslating(true);
    try {
      const api = getApi();
      const translatedTitle = await translateTitle(api, displayTitle);
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
      setFinalMessage(`${displayTitle} ${translatedTitle}\n\n${translatedLines.join("\n")}`);
    } finally {
      setTranslating(false);
    }
  }, [lines, displayTitle, translateTitle]);

  // COPY — copy with 3-second confirmation toast
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(finalMessage)
      .then(() => {
        toast({ title: "Copied to clipboard" });
      })
      .catch(() => {});
  }, [finalMessage]);

  const handleClear = React.useCallback(() => {
    setFinalMessage("");
  }, []);

  const handleRefreshText = React.useCallback(() => {
    setEditLines(lines.join("\n"));
    if (editingText) {
      toast({ title: "Text refreshed from schedule" });
    }
  }, [lines, editingText]);

  // Convert — auto-detect direction Chinese ↔ English
  const handleConvert = React.useCallback(async () => {
    const src = convertSource.trim();
    const dst = convertResult.trim();
    if (!src && !dst) return;
    let text: string;
    let target: string;
    if (src && !dst) {
      // only source filled → translate to other language
      text = src;
      const isChinese = /[\u4e00-\u9fff]/.test(text);
      target = isChinese ? "en" : "zh-TW";
      const api = getApi();
      const translated = await api.translate(text, target);
      setConvertResult(translated);
    } else if (dst && !src) {
      // only result filled → treat as source, flip direction
      text = dst;
      const isChinese = /[\u4e00-\u9fff]/.test(text);
      target = isChinese ? "en" : "zh-TW";
      const api = getApi();
      const translated = await api.translate(text, target);
      setConvertSource(translated);
    } else {
      // both filled → auto-detect source: if one is Chinese and other is English
      const srcIsChinese = /[\u4e00-\u9fff]/.test(src);
      const dstIsChinese = /[\u4e00-\u9fff]/.test(dst);
      if (srcIsChinese && !dstIsChinese) {
        // src=Chinese → translate to English in dst
        const api = getApi();
        const translated = await api.translate(src, "en");
        setConvertResult(translated);
      } else if (!srcIsChinese && dstIsChinese) {
        // src=English → translate to Chinese in dst
        const api = getApi();
        const translated = await api.translate(src, "zh-TW");
        setConvertResult(translated);
      } else {
        // same language in both or can't detect → swap
        setConvertSource(convertResult);
        setConvertResult(convertSource);
      }
    }
  }, [convertSource, convertResult]);

  // Final message height drag
  const handleFinalMsgHeightMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingMsgHeight(true);
  }, []);

  React.useEffect(() => {
    if (!draggingMsgHeight) return;
    const handleMove = (e: MouseEvent) => {
      const container = document.getElementById("final-msg-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      const clamped = Math.max(60, Math.min(600, newHeight));
      setFinalMsgHeight(clamped);
      localStorage.setItem(FINAL_MSG_HEIGHT_KEY, String(clamped));
    };
    const handleUp = () => setDraggingMsgHeight(false);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [draggingMsgHeight]);

  return (
    <div
      className={cn(
        "flex flex-shrink-0 flex-col border-l bg-muted/20 relative",
        className
      )}
      style={{ width: panelWidth }}
    >
      {/* Panel width drag handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 z-10"
        onMouseDown={handleMouseDown}
      />

      {/* Title — click to edit */}
      <div className="border-b px-3 py-2.5">
        {editingTitle ? (
          <textarea
            autoFocus
            className="w-full text-sm font-medium bg-transparent border-b border-primary/50 outline-none resize-none overflow-hidden"
            rows={1}
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                setEditingTitle(false);
              }
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }
            }}
          />
        ) : (
          <h3
            className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary whitespace-pre-wrap"
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
          className="text-[10px] bg-transparent border border-border rounded px-1 py-0.5 flex-1"
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
        <button
          className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted shrink-0"
          onClick={handleRefreshText}
          title="Refresh text from schedule"
        >
          ⟳
        </button>
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

      {/* Update button (only in edit mode, above final message) */}
      {editingText && (
        <div className="border-t px-3 py-1.5">
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleUpdate}
            disabled={updateTimeBlock.isPending}
          >
            {updateTimeBlock.isPending ? "Saving..." : "Update"}
          </Button>
        </div>
      )}

      {/* Final message box with height resize */}
      <div id="final-msg-container" className="border-t px-3 py-2 relative">
        <Label className="text-[10px] text-muted-foreground">Final message</Label>
        <div className="relative mt-1">
          <textarea
            className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 resize-none pr-14"
            style={{ fontFamily, fontSize, height: finalMsgHeight }}
            value={finalMessage}
            onChange={(e) => setFinalMessage(e.target.value)}
            placeholder="EN/CN1/CN2 output appears here..."
          />
          {/* Copy + Clear buttons inside textarea bottom-right */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={handleCopy}
              disabled={!finalMessage}
              title="Copy"
            >
              Copy
            </button>
            <button
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={handleClear}
              disabled={!finalMessage}
              title="Clear"
            >
              Clear
            </button>
          </div>
          {/* Height resize handle */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-primary/30"
            onMouseDown={handleFinalMsgHeightMouseDown}
          />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t px-3 py-2">
        <div className="grid grid-cols-4 gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-0"
            onClick={handleEN}
            disabled={lines.length === 0}
            title="English schedule in final message box"
          >
            EN
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-0"
            onClick={handleCopy}
            disabled={!finalMessage}
            title="Copy final message"
          >
            COPY
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-0"
            onClick={handleCN1}
            disabled={translating || lines.length === 0}
            title="Original + blank + translated"
          >
            CN1
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-0"
            onClick={handleCN2}
            disabled={translating || lines.length === 0}
            title="Per-line translated prefix"
          >
            CN2
          </Button>
        </div>
      </div>

      {/* Convert boxes */}
      <div className="border-t px-3 py-2 space-y-2">
        <Label className="text-[10px] text-muted-foreground">Translate</Label>
        <textarea
          className="w-full text-xs bg-transparent border border-border rounded px-2 py-1.5 resize-none h-16"
          placeholder="Source text (Chinese or English)"
          value={convertSource}
          onChange={(e) => setConvertSource(e.target.value)}
        />
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            className="h-6 text-[10px] flex-1"
            onClick={handleConvert}
            disabled={translating || (!convertSource.trim() && !convertResult.trim())}
          >
            {translating ? "Translating..." : "Convert ↻"}
          </Button>
        </div>
        <textarea
          className="w-full text-xs bg-transparent border border-border rounded px-2 py-1.5 resize-none h-16"
          placeholder="Result"
          value={convertResult}
          onChange={(e) => setConvertResult(e.target.value)}
        />
      </div>
    </div>
  );
}
