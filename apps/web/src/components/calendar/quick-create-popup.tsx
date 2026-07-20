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
import { useCreateTimeBlock } from "@/hooks";

interface QuickCreatePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  startTime: Date;
}

export function QuickCreatePopup({
  open,
  onOpenChange,
  date,
  startTime,
}: QuickCreatePopupProps) {
  const [title, setTitle] = React.useState("");
  const [isBreak, setIsBreak] = React.useState(false);
  const [startTimeInput, setStartTimeInput] = React.useState(
    format(startTime, "HH:mm")
  );
  const [durationInput, setDurationInput] = React.useState("60");

  const createTimeBlock = useCreateTimeBlock();

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setIsBreak(false);
      setStartTimeInput(format(startTime, "HH:mm"));
      setDurationInput("60");
    }
  }, [open, startTime, date]);

  const buildTimeDate = (timeInput: string): Date => {
    const [hours, mins] = timeInput.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hours ?? 0, mins ?? 0, 0, 0);
    return d;
  };

  const handleDurationChange = (value: string) => {
    setDurationInput(value);
  };

  const getEndTime = (): Date => {
    const start = buildTimeDate(startTimeInput);
    const mins = parseInt(durationInput, 10);
    if (!isNaN(mins) && mins > 0) {
      return addMinutes(start, mins);
    }
    return addMinutes(start, 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !isBreak) return;

    const start = buildTimeDate(startTimeInput);
    const end = getEndTime();
    const mins = parseInt(durationInput, 10);

    await createTimeBlock.mutateAsync({
      title: isBreak ? "" : title.trim(),
      startTime: start,
      endTime: end,
      isBreak: isBreak || undefined,
      color: isBreak ? "#9CA3AF" : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] top-[20%]">
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

          {/* Duration */}
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
                {format(startTime, "h:mm a")} – {format(getEndTime(), "h:mm a")}
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

          {/* Start time (editable) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Start</Label>
            <Input
              type="time"
              value={startTimeInput}
              onChange={(e) => setStartTimeInput(e.target.value)}
              className="h-8 w-28 text-sm"
            />
          </div>

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
