import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TimeBlock } from "@open-sunsama/types";
import { toast } from "@/hooks/use-toast";
import { timeBlockKeys } from "@/lib/query-keys";
import { ToastAction } from "@/components/ui";
import { pushUndo } from "./useUndoStack";
import { useUpdateTimeBlock } from "./useTimeBlockMutations";
import { useApiClient } from "@/lib/api";

/**
 * Start a time block (for time tracking)
 * Note: Updates the start time to the current time
 */
export function useStartTimeBlock() {
  const queryClient = useQueryClient();
  const updateTimeBlock = useUpdateTimeBlock();

  return useMutation({
    mutationFn: async (id: string): Promise<TimeBlock> => {
      // Update start time to now
      return updateTimeBlock.mutateAsync({
        id,
        data: {
          startTime: new Date(),
        },
      });
    },
    onSuccess: (updatedTimeBlock) => {
      queryClient.setQueryData(
        timeBlockKeys.detail(updatedTimeBlock.id),
        updatedTimeBlock
      );
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });

      toast({
        title: "Time block started",
        description: "Timer is now running.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to start time block",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Stop a time block (for time tracking)
 * Note: Updates the end time to the current time
 */
export function useStopTimeBlock() {
  const queryClient = useQueryClient();
  const updateTimeBlock = useUpdateTimeBlock();

  return useMutation({
    mutationFn: async (id: string): Promise<TimeBlock> => {
      // Update end time to now
      return updateTimeBlock.mutateAsync({
        id,
        data: {
          endTime: new Date(),
        },
      });
    },
    onSuccess: (updatedTimeBlock) => {
      queryClient.setQueryData(
        timeBlockKeys.detail(updatedTimeBlock.id),
        updatedTimeBlock
      );
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });

      toast({
        title: "Time block stopped",
        description: "Timer has been stopped.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to stop time block",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Resize a time block (update start/end time)
 */
export function useResizeTimeBlock() {
  const updateTimeBlock = useUpdateTimeBlock();

  return useMutation({
    mutationFn: async ({
      id,
      startTime,
      endTime,
    }: {
      id: string;
      startTime?: Date | string;
      endTime?: Date | string;
    }) => {
      return updateTimeBlock.mutateAsync({
        id,
        data: { startTime, endTime },
      });
    },
  });
}

/**
 * Adjust a time block's times with cascade effect - blocks connected by
 * touching boundaries (a block's start = another's end) shift along with
 * it, keeping their own durations. Covers moves, handle resizes, and
 * sidebar time edits. Uses the server-side cascade endpoint for atomic
 * multi-block updates.
 *
 * Every successful change offers an Undo toast: the cascade endpoint
 * returns the pre-change times of every touched block, and undoing
 * restores them all in parallel (bypassing the cascade so the restore
 * doesn't ripple a second time).
 */
export function useCascadeResizeTimeBlock() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      startTime,
      endTime,
      mode,
    }: {
      id: string;
      startTime: Date;
      endTime: Date;
      mode?: 'chain' | 'all-downstream';
    }) => {
      return api.timeBlocks.cascadeResize(id, { startTime, endTime, mode });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });

      const previous = result.previous ?? [];
      if (previous.length === 0) return;

      const restore = async () => {
        try {
          await Promise.all(
            previous.map((p) =>
              api.timeBlocks.update(p.id, {
                startTime: new Date(`${p.date}T${p.startTime}:00`),
                endTime: new Date(`${p.date}T${p.endTime}:00`),
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });
          toast({ title: "Schedule change undone" });
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Undo failed",
            description:
              error instanceof Error ? error.message : "Unknown error",
          });
        }
      };

      pushUndo(`Resize (${previous.length} blocks)`, restore);

      toast({
        title: "Schedule updated",
        description: `${previous.length} block${previous.length === 1 ? "" : "s"} adjusted.`,
        action: (
          <ToastAction
            altText="Undo schedule change"
            onClick={() => {
              void restore();
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to resize time block",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Move a time block to a different time
 */
export function useMoveTimeBlock() {
  const updateTimeBlock = useUpdateTimeBlock();

  return useMutation({
    mutationFn: async ({
      id,
      startTime,
      endTime,
    }: {
      id: string;
      startTime: Date | string;
      endTime: Date | string;
    }) => {
      return updateTimeBlock.mutateAsync({
        id,
        data: { startTime, endTime },
      });
    },
  });
}
