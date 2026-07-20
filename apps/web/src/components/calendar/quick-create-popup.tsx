import * as React from "react";
import { format, addMinutes, differenceInMinutes } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Checkbox,
} from "@/components/ui";
import { ColorSection } from "./time-block-form-sections";
import { useCreateTimeBlock } from "@/hooks";

interface QuickCreatePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  startTime: Date;
  /** When set from empty-slot click, end time is editable directly.
   *  When omitted (bottom-handle click), end is derived from start + duration. */
  endTime?: Date;
}

export function QuickCreatePopup({
  open,
  onOpenChange,
  date,
  startTime,
  endTime,
}: QuickCreatePopupProps) {
  const [title, setTitle] = React.useState("");
  const [isBreak, setIsBreak] = React.useState(false);
  const [color, setColor] = React.useState<string | null>(null);
  const [startTimeInput, setStartTimeInput] = React.useState(
    format(startTime, "HH:mm")
  );
  const [endTimeInput, setEndTimeInput] = React.useState(
    endTime ? format(endTime, "HH:mm") : ""
  );
  const [durationInput, setDurationInput] = React.useState("");

  const createTimeBlock = useCreateTimeBlock();

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setIsBreak(false);
    setColor(null);
    setStartTimeInput(format(startTime, "HH:mm"));
    if (endTime) {
      setEndTimeInput(format(endTime, "HH:mm"));
      const diff = differenceInMinutes(endTime, startTime);
      setDurationInput(String(diff));
    } else {
      setEndTimeInput("");
      setDurationInput("60");
    }
  }, [open, startTime, endTime, date]);

  const buildTimeDate = (timeInput: string): Date => {
    const [hours, mins] = timeInput.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hours ?? 0, mins ?? 0, 0, 0);
    return d;
  };

  // When duration changes, update end time
  const handleDurationChange = (value: string) => {
    setDurationInput(value);
    const mins = parseInt(value, 10);
    if (!isNaN(mins) && mins > 0) {
      const start = buildTimeDate(startTimeInput);
      const newEnd = addMinutes(start, mins);
      setEndTimeInput(format(newEnd, "HH:mm"));
    }
  };

  // When start time changes, preserve duration and recompute end
  const handleStartChange = (value: string) => {
    setStartTimeInput(value);
    const mins = parseInt(durationInput, 10);
    if (!isNaN(mins) && mins > 0) {
      const start = buildTimeDate(value);
      const newEnd = addMinutes(start, mins);
      setEndTimeInput(format(newEnd, "HH:mm"));
    }
  };

  // When end time changes, recompute duration
  const handleEndChange = (value: string) => {
    setEndTimeInput(value);
    const start = buildTimeDate(startTimeInput);
    const end = buildTimeDate(value);
    if (end.getTime() > start.getTime()) {
      const diff = differenceInMinutes(end, start);
      setDurationInput(String(diff));
    }
  };

  const getEndTimeValue = (): Date => {
    if (endTimeInput) {
      return buildTimeDate(endTimeInput);
    }
    const start = buildTimeDate(startTimeInput);
    const mins = parseInt(durationInput, 10);
    return addMinutes(start, isNaN(mins) || mins <= 0 ? 60 : mins);
  };

  const getStartTimeValue = (): Date => {
    return buildTimeDate(startTimeInput);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !isBreak) return;

    const start = getStartTimeValue();
    const end = getEndTimeValue();

    await createTimeBlock.mutateAsync({
      title: isBreak ? "" : title.trim(),
      startTime: start,
      endTime: end,
      isBreak: isBreak || undefined,
      color: isBreak ? "#9CA3AF" : (color || undefined),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>New time block</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isBreak ? "Break (optional)" : "What are you working on?"}
              autoFocus
              className="h-9 text-sm"
            />
          </div>

          {/* Duration — shows time range */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={480}
                value={durationInput}
                onChange={(e) => handleDurationChange(e.target.value)}
                className="h-8 w-20 text-sm"
              />
              <span className="text-xs text-muted-foreground">min</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {format(getStartTimeValue(), "h:mm a")} –{" "}
                {format(getEndTimeValue(), "h:mm a")}
              </span>
            </div>
          </div>

          {/* Break checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={isBreak}
              onCheckedChange={(checked) => {
                setIsBreak(checked === true);
                if (checked && !title) {
                  setTitle("Break");
                } else if (!checked && title === "Break") {
                  setTitle("");
                }
              }}
            />
            <span className="text-sm text-muted-foreground">Break</span>
          </label>

          {/* Start time */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Start</Label>
            <Input
              type="time"
              value={startTimeInput}
              onChange={(e) => handleStartChange(e.target.value)}
              className="h-8 w-28 text-sm"
            />
          </div>

          {/* End time */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">End</Label>
            <Input
              type="time"
              value={endTimeInput}
              onChange={(e) => handleEndChange(e.target.value)}
              className="h-8 w-28 text-sm"
            />
          </div>

          {/* Color */}
          <ColorSection color={color} onChange={setColor} />

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={(!title.trim() && !isBreak) || createTimeBlock.isPending}
            >
              {createTimeBlock.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
