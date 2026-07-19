import {
  addMinutes,
  setHours,
  setMinutes,
  differenceInMinutes,
  format,
} from "date-fns";
import type { TimeBlock } from "@open-sunsama/types";
import type { DropPreview, SnapInterval } from "./calendar-dnd-types";

/**
 * Constants for timeline calculations
 */
export const HOUR_HEIGHT = 64; // pixels per hour
export const SNAP_INTERVAL = 15; // minutes
export const MIN_BLOCK_DURATION = 15; // minimum duration in minutes
export const TIMELINE_START_HOUR = 0; // 00:00
export const TIMELINE_END_HOUR = 23; // 23:00

/**
 * Calculate time from Y position on timeline
 */
export function calculateTimeFromY(y: number, baseDate: Date): Date {
  // Calculate hours and minutes from Y position
  const totalMinutes = (y / HOUR_HEIGHT) * 60;
  const hours = Math.floor(totalMinutes / 60) + TIMELINE_START_HOUR;
  const minutes = totalMinutes % 60;

  // Create date with calculated time
  let result = setHours(baseDate, Math.min(hours, 23));
  result = setMinutes(result, Math.min(Math.max(0, minutes), 59));

  return result;
}

/**
 * Calculate Y position from time
 */
export function calculateYFromTime(time: Date): number {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  return ((hours - TIMELINE_START_HOUR) * 60 + minutes) * (HOUR_HEIGHT / 60);
}

/**
 * Snap a candidate start time to the end of an adjacent event.
 *
 * When the (already interval-snapped) start lands within `thresholdMins`
 * of another interval's end, the start snaps to that end — so a dropped
 * or moved block butts up against the previous event instead of leaving
 * a sliver gap or slightly overlapping it. The caller keeps the block's
 * own duration by computing `end = start + duration` afterwards.
 *
 * `excludeId` skips the interval being dragged — without it, a block
 * nudged within a threshold of its *own* end would snap onto itself.
 */
export function snapStartToAdjacentEnd(
  startTime: Date,
  intervals: SnapInterval[] | undefined,
  excludeId?: string,
  thresholdMins: number = SNAP_INTERVAL
): Date {
  if (!intervals || intervals.length === 0) return startTime;
  const startMs = startTime.getTime();
  let bestEnd: Date | null = null;
  let bestDiff = Infinity;
  for (const iv of intervals) {
    if (excludeId && iv.id === excludeId) continue;
    const diff = Math.abs(startMs - iv.end.getTime());
    // diff === 0 means already perfectly back-to-back; harmless to keep.
    if (diff <= thresholdMins * 60_000 && diff < bestDiff) {
      bestDiff = diff;
      bestEnd = iv.end;
    }
  }
  return bestEnd ? new Date(bestEnd) : startTime;
}

/**
 * Snap time to nearest interval
 */
export function snapToInterval(time: Date, intervalMinutes: number = SNAP_INTERVAL): Date {
  const minutes = time.getMinutes();
  const snappedMinutes = Math.round(minutes / intervalMinutes) * intervalMinutes;
  
  let result = setMinutes(time, snappedMinutes % 60);
  
  // Handle overflow to next hour
  if (snappedMinutes >= 60) {
    result = setHours(result, result.getHours() + Math.floor(snappedMinutes / 60));
    result = setMinutes(result, snappedMinutes % 60);
  }
  
  return result;
}

/**
 * Calculate drop preview for task being dragged to timeline
 */
export function calculateTaskDropPreview(
  y: number,
  baseDate: Date,
  durationMins: number = 60,
  snapIntervals?: SnapInterval[]
): DropPreview {
  const rawTime = calculateTimeFromY(y, baseDate);
  let startTime = snapToInterval(rawTime);

  // Adjacency snap: butt the new block against the end of a previous
  // event when close by, keeping the block's own duration. Guard the
  // day boundary — a snap that would push the end past midnight is
  // worse than the sliver gap it was avoiding.
  const adjacentStart = snapStartToAdjacentEnd(startTime, snapIntervals);
  if (minutesFromMidnight(adjacentStart) + durationMins <= TIMELINE_END_MINUTE) {
    startTime = adjacentStart;
  }

  const endTime = addMinutes(startTime, durationMins);

  const top = calculateYFromTime(startTime);
  const height = (durationMins / 60) * HOUR_HEIGHT;

  return { startTime, endTime, top, height };
}

/**
 * The lowest start-of-minute slot the timeline allows. Set to
 * (TIMELINE_END_HOUR + 1) so dragging an event to "midnight tomorrow"
 * is forbidden — without this clamp, dragging a 4h event past 23:00
 * silently produces an event that crosses midnight onto the next day,
 * persisting on a date the user wasn't viewing.
 */
const TIMELINE_END_MINUTE = (TIMELINE_END_HOUR + 1) * 60; // 24 * 60 = 1440

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Calculate preview for moving a time block
 */
export function calculateMovePreview(
  deltaY: number,
  block: TimeBlock,
  baseDate: Date,
  snapIntervals?: SnapInterval[]
): DropPreview {
  const originalDuration = differenceInMinutes(
    new Date(block.endTime),
    new Date(block.startTime)
  );

  const originalTop = calculateYFromTime(new Date(block.startTime));
  const newTop = Math.max(0, originalTop + deltaY);

  const rawStartTime = calculateTimeFromY(newTop, baseDate);
  let startTime = snapToInterval(rawStartTime);

  // Clamp the start so the entire event still fits inside the day.
  // Without this, a 4h event dragged past 20:00 would silently roll
  // onto the next day's date. Also detect snap-rolled-to-next-day
  // (snapToInterval(23:53) → tomorrow 00:00) and pull back to today.
  const sameDay =
    startTime.getDate() === baseDate.getDate() &&
    startTime.getMonth() === baseDate.getMonth() &&
    startTime.getFullYear() === baseDate.getFullYear();
  const startMins = minutesFromMidnight(startTime);
  const maxStartMins = TIMELINE_END_MINUTE - originalDuration;
  if (!sameDay || startMins > maxStartMins) {
    const startOfDayBase = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      0,
      0,
      0,
      0
    );
    startTime = addMinutes(startOfDayBase, Math.max(0, maxStartMins));
  }

  // Adjacency snap: butt the moved block against the end of a previous
  // event when close by, keeping its own duration. The dragged block's
  // own interval is excluded so nudging it within a threshold of its
  // own end doesn't snap it onto itself. Guard the day boundary — only
  // take the snap if the full block still fits inside the day.
  const adjacentStart = snapStartToAdjacentEnd(
    startTime,
    snapIntervals,
    block.id
  );
  if (
    minutesFromMidnight(adjacentStart) + originalDuration <=
    TIMELINE_END_MINUTE
  ) {
    startTime = adjacentStart;
  }

  const endTime = addMinutes(startTime, originalDuration);

  const top = calculateYFromTime(startTime);
  const height = (originalDuration / 60) * HOUR_HEIGHT;

  return { startTime, endTime, top, height };
}

/**
 * Calculate preview for resizing a time block
 */
export function calculateResizePreview(
  deltaY: number,
  block: TimeBlock,
  edge: "top" | "bottom",
  baseDate: Date
): DropPreview {
  const originalStart = new Date(block.startTime);
  const originalEnd = new Date(block.endTime);
  
  let startTime: Date;
  let endTime: Date;

  if (edge === "top") {
    const originalTop = calculateYFromTime(originalStart);
    const newTop = Math.max(0, originalTop + deltaY);
    const rawStartTime = calculateTimeFromY(newTop, baseDate);
    startTime = snapToInterval(rawStartTime);
    endTime = originalEnd;
    
    // Ensure minimum duration
    const duration = differenceInMinutes(endTime, startTime);
    if (duration < MIN_BLOCK_DURATION) {
      startTime = addMinutes(endTime, -MIN_BLOCK_DURATION);
    }
  } else {
    startTime = originalStart;
    const originalBottom = calculateYFromTime(originalEnd);
    const newBottom = originalBottom + deltaY;
    const rawEndTime = calculateTimeFromY(newBottom, baseDate);
    endTime = snapToInterval(rawEndTime);

    // Clamp end so it can't spill past midnight onto the next day.
    // `snapToInterval(23:53)` rolls to next-day 00:00, which the
    // previous clamp's recomputation would also produce — a no-op,
    // and `calculateYFromTime(00:00)` renders at top=0 (preview
    // collapses). Pull back to the last full slot of the day instead
    // (24:00 - SNAP_INTERVAL) so the preview stays visible. For an
    // event ending at literal midnight, use the detail sheet.
    const crossedMidnight =
      endTime.getDate() !== originalStart.getDate() ||
      endTime.getMonth() !== originalStart.getMonth() ||
      endTime.getFullYear() !== originalStart.getFullYear() ||
      minutesFromMidnight(endTime) > TIMELINE_END_MINUTE;
    if (crossedMidnight) {
      const lastSlotMins = TIMELINE_END_MINUTE - SNAP_INTERVAL;
      const startOfDayBase = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        0,
        0,
        0,
        0
      );
      endTime = addMinutes(startOfDayBase, lastSlotMins);
    }

    // Ensure minimum duration
    const duration = differenceInMinutes(endTime, startTime);
    if (duration < MIN_BLOCK_DURATION) {
      endTime = addMinutes(startTime, MIN_BLOCK_DURATION);
    }
  }

  const top = calculateYFromTime(startTime);
  const height = Math.max(
    (MIN_BLOCK_DURATION / 60) * HOUR_HEIGHT,
    (differenceInMinutes(endTime, startTime) / 60) * HOUR_HEIGHT
  );

  return { startTime, endTime, top, height };
}

/**
 * Format time range for display
 */
export function formatTimeRange(start: Date, end: Date): string {
  return `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}
