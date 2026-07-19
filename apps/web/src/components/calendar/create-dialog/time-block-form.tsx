import * as React from "react";
import { format } from "date-fns";
import { ListTodo, Clock } from "lucide-react";
import { useCreateTimeBlock, useTasks } from "@/hooks";
import {
  Button,
  DialogFooter,
  Input,
  Label,
} from "@/components/ui";

/**
 * Time block sub-form for the create dialog. Optionally links the
 * block to an existing unscheduled task on the same day.
 */
export function TimeBlockForm({
  date,
  startTime,
  endTime,
  onClose,
}: {
  date: Date;
  startTime: Date;
  endTime: Date;
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
    null
  );
  const [showTaskList, setShowTaskList] = React.useState(false);
  const [startTimeInput, setStartTimeInput] = React.useState(format(startTime, "HH:mm"));
  const [endTimeInput, setEndTimeInput] = React.useState(format(endTime, "HH:mm"));

  const createTimeBlock = useCreateTimeBlock();

  const dateString = format(date, "yyyy-MM-dd");
  const { data: tasks = [] } = useTasks({
    scheduledDate: dateString,
    limit: 200,
  });
  const availableTasks = tasks.filter((task) => !task.completedAt);

  React.useEffect(() => {
    setTitle("");
    setSelectedTaskId(null);
    setShowTaskList(false);
    setStartTimeInput(format(startTime, "HH:mm"));
    setEndTimeInput(format(endTime, "HH:mm"));
  }, [date, startTime, endTime]);

  React.useEffect(() => {
    if (selectedTaskId) {
      const task = availableTasks.find((t) => t.id === selectedTaskId);
      if (task) setTitle(task.title);
    }
  }, [selectedTaskId, availableTasks]);

  const buildTimeDate = (timeInput: string): Date | null => {
    const [hours, mins] = timeInput.split(":").map(Number);
    if (isNaN(hours ?? 0) || isNaN(mins ?? 0)) return null;
    const d = new Date(date);
    d.setHours(hours ?? 0, mins ?? 0, 0, 0);
    return d;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalStart = buildTimeDate(startTimeInput) ?? startTime;
    const finalEnd = buildTimeDate(endTimeInput) ?? endTime;

    await createTimeBlock.mutateAsync({
      title: title.trim(),
      startTime: finalStart,
      endTime: finalEnd,
      taskId: selectedTaskId ?? undefined,
    });
    onClose();
  };

  const selectedTask = selectedTaskId
    ? availableTasks.find((t) => t.id === selectedTaskId)
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tb-title">Title</Label>
        <Input
          id="tb-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you working on?"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={startTimeInput}
            onChange={(e) => setStartTimeInput(e.target.value)}
            className="h-9 w-28 text-sm"
          />
          <span className="text-muted-foreground/60">–</span>
          <Input
            type="time"
            value={endTimeInput}
            onChange={(e) => setEndTimeInput(e.target.value)}
            className="h-9 w-28 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ListTodo className="h-4 w-4" />
          Link to task (optional)
        </Label>

        {selectedTask ? (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <span className="truncate text-sm">{selectedTask.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedTaskId(null);
                setTitle("");
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowTaskList(!showTaskList)}
            >
              {availableTasks.length > 0
                ? "Select a task..."
                : "No tasks available"}
            </Button>

            {showTaskList && availableTasks.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border bg-background shadow-md">
                {availableTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="w-full truncate px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setShowTaskList(false);
                    }}
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!title.trim() || createTimeBlock.isPending}
        >
          {createTimeBlock.isPending ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
