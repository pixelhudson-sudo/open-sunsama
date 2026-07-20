import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, Label, Textarea, Checkbox } from "@/components/ui";
import { FileText } from "lucide-react";

interface TitleSectionProps {
  title: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export function TimeBlockTitleSection({
  title,
  onChange,
  onBlur,
}: TitleSectionProps) {
  return (
    <Input
      value={title}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
      className="border-none shadow-none text-base font-medium p-0 h-auto focus-visible:ring-0 bg-transparent"
      placeholder="Time block title"
    />
  );
}

interface DurationInputProps {
  minutes: number;
  onChange: (minutes: number) => void;
  onBlur: () => void;
}

export function DurationInputSection({
  minutes,
  onChange,
  onBlur,
}: DurationInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Duration (minutes)</Label>
      <Input
        type="number"
        min={1}
        max={1440}
        value={minutes}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
        className="h-8 w-24 text-sm"
      />
    </div>
  );
}

interface TimeRangeSectionProps {
  startTime: string;
  endTime: string;
  durationMins: number;
  /** Duration lock: end time is derived (start + duration), not editable */
  endDisabled?: boolean;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onBlur: () => void;
}

export function TimeRangeSection({
  startTime,
  endTime,
  durationMins,
  endDisabled = false,
  onStartTimeChange,
  onEndTimeChange,
  onBlur,
}: TimeRangeSectionProps) {
  const formatDuration = () => {
    const h = Math.floor(durationMins / 60);
    const m = durationMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Time</Label>
      <div className="flex items-center gap-2 text-sm">
        <Input
          type="time"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
          className="h-8 w-24 text-sm"
        />
        <span className="text-muted-foreground/60">–</span>
        <Input
          type="time"
          value={endTime}
          onChange={(e) => onEndTimeChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
          disabled={endDisabled}
          className={cn("h-8 w-24 text-sm", endDisabled && "opacity-50")}
          title={endDisabled ? "Duration is locked — end time follows the start" : undefined}
        />
        <span className="text-xs text-muted-foreground ml-auto font-semibold">
          {formatDuration()}
        </span>
      </div>
    </div>
  );
}

export const COLOR_OPTIONS = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#22C55E", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#A855F7", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#6366F1", label: "Indigo" },
  { value: "#0EA5E9", label: "Sky" },
];

interface ColorSectionProps {
  color: string | null;
  onChange: (color: string) => void;
}

export function ColorSection({ color, onChange }: ColorSectionProps) {
  return (
    <div className="flex items-center gap-1.5">
      {COLOR_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "h-6 w-6 rounded-full transition-all",
            color === option.value
              ? "ring-2 ring-offset-1 ring-primary/60"
              : "hover:scale-110"
          )}
          style={{ backgroundColor: option.value }}
          onClick={() => onChange(option.value)}
          title={option.label}
        />
      ))}
    </div>
  );
}

interface NotesSectionProps {
  notes: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/**
 * @deprecated Use NotesField from "@/components/ui/notes-field" instead
 */
export function TimeBlockNotesSection({
  notes,
  onChange,
  onBlur,
}: NotesSectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="block-notes" className="flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Notes
      </Label>
      <Textarea
        id="block-notes"
        value={notes}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Add notes..."
        rows={4}
      />
    </div>
  );
}
