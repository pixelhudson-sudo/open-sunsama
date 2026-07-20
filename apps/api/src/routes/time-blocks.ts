/**
 * Time block routes for Open Sunsama API
 * Handles CRUD operations for time blocks
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb, eq, and, asc, timeBlocks, tasks, users, sql } from '@open-sunsama/database';
import { NotFoundError, ValidationError, uuidSchema } from '@open-sunsama/utils';
import { auth, requireScopes, type AuthVariables } from '../middleware/auth.js';
import {
  createTimeBlockSchema, updateTimeBlockSchema, timeBlockFilterSchema, calculateDuration,
  quickScheduleSchema, calculateEndTime, cascadeResizeSchema, autoScheduleSchema,
  timeToMinutes, minutesToTime,
} from '../validation/time-blocks.js';

// Default working hours for auto-scheduling (used when user has no preference)
const DEFAULT_WORK_START_HOUR = 9;  // 9:00 AM
const DEFAULT_WORK_END_HOUR = 18;   // 6:00 PM

/**
 * Find the next available time slot, preferring working hours.
 * If no slot is available within working hours, schedules after the last block
 * or after work end (whichever is later). Never returns null.
 * @param existingBlocks - Existing time blocks for the date, sorted by startTime
 * @param durationMins - Duration needed for the new block
 * @param _date - The date to schedule on (YYYY-MM-DD format)
 * @param earliestStartMinutes - Optional earliest start time in minutes from midnight
 * @param workStartHour - Work day start hour (0-23)
 * @param workEndHour - Work day end hour (0-23)
 * @returns The available slot (always returns a valid slot)
 */
function findNextAvailableSlot(
  existingBlocks: Array<{ startTime: string; endTime: string }>,
  durationMins: number,
  _date: string,
  earliestStartMinutes?: number,
  workStartHour: number = DEFAULT_WORK_START_HOUR,
  workEndHour: number = DEFAULT_WORK_END_HOUR,
): { startTime: string; endTime: string } {
  const workStartMinutes = workStartHour * 60;
  const workEndMinutes = workEndHour * 60;

  // Use the later of work start or the earliest requested start time
  // Round up to next 15-minute interval for clean scheduling
  let effectiveStart = workStartMinutes;
  if (earliestStartMinutes !== undefined) {
    const roundedMinutes = Math.ceil(earliestStartMinutes / 15) * 15;
    effectiveStart = Math.max(workStartMinutes, roundedMinutes);
  }

  // If no existing blocks, start at effective start time
  if (existingBlocks.length === 0) {
    return {
      startTime: minutesToTime(effectiveStart),
      endTime: minutesToTime(effectiveStart + durationMins),
    };
  }

  // Try to find a gap within working hours first
  let currentStart = effectiveStart;

  for (const block of existingBlocks) {
    const blockStartMinutes = timeToMinutes(block.startTime);
    const blockEndMinutes = timeToMinutes(block.endTime);

    // Skip blocks that end before our effective start
    if (blockEndMinutes <= effectiveStart) continue;

    // Check if there's a gap before this block
    if (blockStartMinutes > currentStart) {
      const gapSize = blockStartMinutes - currentStart;
      if (gapSize >= durationMins) {
        const endMinutes = currentStart + durationMins;
        if (endMinutes <= workEndMinutes) {
          return {
            startTime: minutesToTime(currentStart),
            endTime: minutesToTime(endMinutes),
          };
        }
      }
    }

    // Move current start to the end of this block
    currentStart = Math.max(currentStart, blockEndMinutes);
  }

  // Check if there's space after the last block within working hours
  if (currentStart < workEndMinutes) {
    const endMinutes = currentStart + durationMins;
    if (endMinutes <= workEndMinutes) {
      return {
        startTime: minutesToTime(currentStart),
        endTime: minutesToTime(endMinutes),
      };
    }
  }

  // No slot within working hours - schedule after the last block or after work end
  // (whichever is later), so the task still gets scheduled
  const lastBlockEnd = existingBlocks.length > 0
    ? Math.max(...existingBlocks.map(b => timeToMinutes(b.endTime)))
    : workEndMinutes;
  const overflowStart = Math.max(currentStart, lastBlockEnd);

  return {
    startTime: minutesToTime(overflowStart),
    endTime: minutesToTime(overflowStart + durationMins),
  };
}
import { publishEvent } from '../lib/websocket/index.js';

const timeBlocksRouter = new Hono<{ Variables: AuthVariables }>();
timeBlocksRouter.use('*', auth);

/** GET /time-blocks - List time blocks with filters */
timeBlocksRouter.get('/', requireScopes('time-blocks:read'), zValidator('query', timeBlockFilterSchema), async (c) => {
  const userId = c.get('userId');
  const filters = c.req.valid('query');
  const db = getDb();
  const conditions = [eq(timeBlocks.userId, userId)];

  if (filters.date) conditions.push(eq(timeBlocks.date, filters.date));
  if (filters.from) conditions.push(sql`${timeBlocks.date} >= ${filters.from}`);
  if (filters.to) conditions.push(sql`${timeBlocks.date} <= ${filters.to}`);
  if (filters.taskId) conditions.push(eq(timeBlocks.taskId, filters.taskId));

  const offset = (filters.page - 1) * filters.limit;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(timeBlocks).where(and(...conditions));
  const total = countResult?.count || 0;

  const results = await db
    .select({ timeBlock: timeBlocks, task: tasks })
    .from(timeBlocks)
    .leftJoin(tasks, eq(timeBlocks.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(asc(timeBlocks.date), asc(timeBlocks.startTime), asc(timeBlocks.position))
    .limit(filters.limit)
    .offset(offset);

  return c.json({
    success: true,
    data: results.map(({ timeBlock, task }) => ({ ...timeBlock, task: task || null })),
    meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
  });
});

/** POST /time-blocks - Create a new time block */
timeBlocksRouter.post('/', requireScopes('time-blocks:write'), zValidator('json', createTimeBlockSchema), async (c) => {
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = getDb();

  if (data.taskId) {
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, data.taskId), eq(tasks.userId, userId))).limit(1);
    if (!task) throw new NotFoundError('Task', data.taskId);
  }

  const durationMins = calculateDuration(data.startTime, data.endTime);
  let position = data.position;
  if (position === undefined) {
    const [maxPos] = await db
      .select({ max: sql<number>`COALESCE(MAX(${timeBlocks.position}), -1)` })
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, data.date)));
    position = (maxPos?.max ?? -1) + 1;
  }

  const [newTimeBlock] = await db.insert(timeBlocks).values({
    userId, taskId: data.taskId ?? null, title: data.title, description: data.description ?? null,
    date: data.date, startTime: data.startTime, endTime: data.endTime, durationMins, color: data.color,
    isDurationLocked: data.isDurationLocked ?? false, isBreak: data.isBreak ?? false, position,
  }).returning();

  let task = null;
  if (newTimeBlock?.taskId) {
    [task] = await db.select().from(tasks).where(eq(tasks.id, newTimeBlock.taskId)).limit(1);
  }

  // Publish realtime event (fire and forget)
  if (newTimeBlock) {
    publishEvent(userId, 'timeblock:created', {
      timeBlockId: newTimeBlock.id,
      date: newTimeBlock.date,
    });
  }

  return c.json({ success: true, data: { ...newTimeBlock, task } }, 201);
});

/** POST /time-blocks/quick-schedule - Create a time block from a task */
timeBlocksRouter.post('/quick-schedule', requireScopes('time-blocks:write'), zValidator('json', quickScheduleSchema), async (c) => {
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = getDb();

  // Look up the task
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, data.taskId), eq(tasks.userId, userId))).limit(1);
  if (!task) throw new NotFoundError('Task', data.taskId);

  // Calculate end time from start time + duration
  const endTime = calculateEndTime(data.startTime, data.durationMins);
  const durationMins = data.durationMins;

  // Get next position for this date
  const [maxPos] = await db
    .select({ max: sql<number>`COALESCE(MAX(${timeBlocks.position}), -1)` })
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, data.date)));
  const position = (maxPos?.max ?? -1) + 1;

  // Create time block with task's title and link to task
  const [newTimeBlock] = await db.insert(timeBlocks).values({
    userId,
    taskId: data.taskId,
    title: task.title,
    description: task.notes ?? null,
    date: data.date,
    startTime: data.startTime,
    endTime,
    durationMins,
    color: data.color ?? '#3B82F6',
    position,
  }).returning();

  // Publish realtime event (fire and forget)
  if (newTimeBlock) {
    publishEvent(userId, 'timeblock:created', {
      timeBlockId: newTimeBlock.id,
      date: newTimeBlock.date,
    });
  }

  return c.json({ success: true, data: { ...newTimeBlock, task } }, 201);
});

/** POST /time-blocks/auto-schedule - Intelligently schedule a task to the next available time slot */
timeBlocksRouter.post('/auto-schedule', requireScopes('time-blocks:write'), zValidator('json', autoScheduleSchema), async (c) => {
  const userId = c.get('userId');
  const { taskId, currentTime } = c.req.valid('json');
  const db = getDb();

  // Look up the task
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
  if (!task) throw new NotFoundError('Task', taskId);

  // Determine the date to schedule on (task's scheduledDate or today)
  const scheduleDate = task.scheduledDate ?? new Date().toISOString().split('T')[0]!;

  // Get duration from task or use default of 30 minutes
  const durationMins = task.estimatedMins ?? 30;

  // Get existing time blocks for this date, ordered by start time
  const existingBlocks = await db
    .select({ startTime: timeBlocks.startTime, endTime: timeBlocks.endTime })
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, scheduleDate)))
    .orderBy(asc(timeBlocks.startTime));

  // Fetch user preferences for working hours
  const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
  const workStartHour = user?.preferences?.workStartHour ?? DEFAULT_WORK_START_HOUR;
  const workEndHour = user?.preferences?.workEndHour ?? DEFAULT_WORK_END_HOUR;

  // Convert currentTime (HH:mm) to minutes if provided
  const earliestStartMinutes = currentTime ? timeToMinutes(currentTime) : undefined;

  // Find the next available slot (never fails - schedules beyond working hours if needed)
  const slot = findNextAvailableSlot(existingBlocks, durationMins, scheduleDate, earliestStartMinutes, workStartHour, workEndHour);

  // Get next position for this date
  const [maxPos] = await db
    .select({ max: sql<number>`COALESCE(MAX(${timeBlocks.position}), -1)` })
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, scheduleDate)));
  const position = (maxPos?.max ?? -1) + 1;

  // Create the time block
  const [newTimeBlock] = await db.insert(timeBlocks).values({
    userId,
    taskId,
    title: task.title,
    description: task.notes ?? null,
    date: scheduleDate,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMins,
    color: '#3B82F6',
    position,
  }).returning();

  // Publish realtime event (fire and forget)
  if (newTimeBlock) {
    publishEvent(userId, 'timeblock:created', {
      timeBlockId: newTimeBlock.id,
      date: newTimeBlock.date,
    });
  }

  return c.json({ success: true, data: { ...newTimeBlock, task } }, 201);
});

/** GET /time-blocks/:id - Get a single time block by ID */
timeBlocksRouter.get('/:id', requireScopes('time-blocks:read'), zValidator('param', z.object({ id: uuidSchema })), async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.valid('param');
  const db = getDb();

  const [result] = await db
    .select({ timeBlock: timeBlocks, task: tasks })
    .from(timeBlocks)
    .leftJoin(tasks, eq(timeBlocks.taskId, tasks.id))
    .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId)))
    .limit(1);

  if (!result) throw new NotFoundError('Time block', id);
  return c.json({ success: true, data: { ...result.timeBlock, task: result.task || null } });
});

/** PATCH /time-blocks/:id - Update a time block */
timeBlocksRouter.patch('/:id', requireScopes('time-blocks:write'), zValidator('param', z.object({ id: uuidSchema })), zValidator('json', updateTimeBlockSchema), async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');
  const db = getDb();

  const [existing] = await db.select().from(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).limit(1);
  if (!existing) throw new NotFoundError('Time block', id);

  if (updates.taskId) {
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, updates.taskId), eq(tasks.userId, userId))).limit(1);
    if (!task) throw new NotFoundError('Task', updates.taskId);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.taskId !== undefined) updateData.taskId = updates.taskId;
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.startTime !== undefined) updateData.startTime = updates.startTime;
  if (updates.endTime !== undefined) updateData.endTime = updates.endTime;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.isDurationLocked !== undefined) updateData.isDurationLocked = updates.isDurationLocked;
  if (updates.isBreak !== undefined) updateData.isBreak = updates.isBreak;
  if (updates.position !== undefined) updateData.position = updates.position;

  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    updateData.durationMins = calculateDuration(updates.startTime ?? existing.startTime, updates.endTime ?? existing.endTime);
  }

  const [updatedTimeBlock] = await db.update(timeBlocks).set(updateData).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).returning();

  let task = null;
  if (updatedTimeBlock?.taskId) {
    [task] = await db.select().from(tasks).where(eq(tasks.id, updatedTimeBlock.taskId)).limit(1);
  }

  // Publish realtime event (fire and forget)
  if (updatedTimeBlock) {
    publishEvent(userId, 'timeblock:updated', {
      timeBlockId: updatedTimeBlock.id,
      date: updatedTimeBlock.date,
    });
  }

  return c.json({ success: true, data: { ...updatedTimeBlock, task } });
});

/**
 * PATCH /time-blocks/:id/cascade-resize - Adjust a block's times and
 * cascade the change through blocks connected by touching boundaries.
 * Handles moves (whole chain follows), resizes (the changed boundary's
 * side follows), and sidebar time edits — connected blocks keep their
 * own durations.
 */
timeBlocksRouter.patch('/:id/cascade-resize', requireScopes('time-blocks:write'), zValidator('param', z.object({ id: uuidSchema })), zValidator('json', cascadeResizeSchema), async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.valid('param');
  const { startTime: newStartTime, endTime: newEndTime } = c.req.valid('json');
  const db = getDb();

  // Fetch the target block
  const [targetBlock] = await db.select().from(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).limit(1);
  if (!targetBlock) throw new NotFoundError('Time block', id);

  // Duration lock: the target's duration is immutable. Moves (which
  // preserve duration) are fine; any change to the start/end span is
  // rejected. The client hides resize affordances for locked blocks —
  // this is the server-side backstop.
  const lockedDuration = timeToMinutes(targetBlock.endTime) - timeToMinutes(targetBlock.startTime);
  if (
    targetBlock.isDurationLocked &&
    timeToMinutes(newEndTime) - timeToMinutes(newStartTime) !== lockedDuration
  ) {
    throw new ValidationError('Duration is locked for this time block', {
      endTime: ['Duration is locked — unlock it in the block details to resize'],
    });
  }

  const originalStartTime = targetBlock.startTime;
  const targetDate = targetBlock.date;

  // Fetch all blocks for the same date, ordered by start time
  const allBlocks = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, targetDate)))
    .orderBy(asc(timeBlocks.startTime));

  // Chain cascade: blocks connected by touching boundaries move together.
  //
  // A block is "downstream-connected" to the target when its start time
  // equals the target's (or another shifted block's) ORIGINAL end time,
  // and "upstream-connected" when its end time equals the target's (or
  // another shifted block's) ORIGINAL start time. The changed boundary
  // propagates its delta through the chain — every connected block shifts
  // by the same delta while keeping its own duration:
  //
  //   - move (both boundaries shift equally): the whole connected chain
  //     moves rigidly in both directions
  //   - resize end / edit end only: the downstream chain follows
  //   - resize start / edit start only: the upstream chain follows
  //
  // Editing the first block of a back-to-back day therefore ripples
  // through every consecutively connected block.
  const originalEndTime = targetBlock.endTime;
  const oldStartMinutes = timeToMinutes(originalStartTime);
  const oldEndMinutes = timeToMinutes(originalEndTime);
  const upstreamDelta = timeToMinutes(newStartTime) - oldStartMinutes;
  const downstreamDelta = timeToMinutes(newEndTime) - oldEndMinutes;

  // Calculate the updates needed
  type BlockUpdate = { id: string; startTime: string; endTime: string; durationMins: number };
  const updates: BlockUpdate[] = [];
  // Pre-change times of every touched block, returned to the client so
  // the change can be undone with a single restore batch.
  const previous: Array<{ id: string; date: string; startTime: string; endTime: string }> = [];

  // First, add the resized block's update
  const newDuration = calculateDuration(newStartTime, newEndTime);
  updates.push({
    id: targetBlock.id,
    startTime: newStartTime,
    endTime: newEndTime,
    durationMins: newDuration,
  });
  previous.push({
    id: targetBlock.id,
    date: targetDate,
    startTime: originalStartTime,
    endTime: originalEndTime,
  });

  const otherBlocks = allBlocks.filter((block) => block.id !== id);
  const moved = new Set<string>();

  // Walk one direction of the chain. `boundaryOf` picks the touching
  // boundary used for matching, `continuationOf` the boundary that
  // extends the chain. Guards the day boundary: a block that would be
  // pushed past midnight is left in place and the chain stops at it
  // (rather than wrapping it into the early morning).
  const walkChain = (
    delta: number,
    anchorMinutes: number,
    boundaryOf: (block: (typeof otherBlocks)[number]) => number,
    continuationOf: (block: (typeof otherBlocks)[number]) => number
  ) => {
    if (delta === 0) return;
    let frontier = new Set([anchorMinutes]);
    while (frontier.size > 0) {
      const next = new Set<number>();
      for (const block of otherBlocks) {
        if (moved.has(block.id)) continue;
        if (!frontier.has(boundaryOf(block))) continue;
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        const shiftedStart = blockStart + delta;
        const shiftedEnd = blockEnd + delta;
        if (shiftedStart < 0 || shiftedEnd > 24 * 60) continue;
        moved.add(block.id);
        updates.push({
          id: block.id,
          startTime: minutesToTime(shiftedStart),
          endTime: minutesToTime(shiftedEnd),
          durationMins: blockEnd - blockStart,
        });
        previous.push({
          id: block.id,
          date: block.date,
          startTime: block.startTime,
          endTime: block.endTime,
        });
        next.add(continuationOf(block));
      }
      frontier = next;
    }
  };

  // Downstream: blocks whose START touches the target's ORIGINAL end.
  walkChain(
    downstreamDelta,
    oldEndMinutes,
    (block) => timeToMinutes(block.startTime),
    (block) => timeToMinutes(block.endTime)
  );
  // Upstream: blocks whose END touches the target's ORIGINAL start.
  walkChain(
    upstreamDelta,
    oldStartMinutes,
    (block) => timeToMinutes(block.endTime),
    (block) => timeToMinutes(block.startTime)
  );

  // Execute all updates in a single transaction
  const updatedBlocks = await db.transaction(async (tx) => {
    const results: typeof timeBlocks.$inferSelect[] = [];

    for (const update of updates) {
      const [updated] = await tx
        .update(timeBlocks)
        .set({
          startTime: update.startTime,
          endTime: update.endTime,
          durationMins: update.durationMins,
          updatedAt: new Date(),
        })
        .where(and(eq(timeBlocks.id, update.id), eq(timeBlocks.userId, userId)))
        .returning();

      if (updated) {
        results.push(updated);
      }
    }

    return results;
  });

  // Fetch tasks for all updated blocks
  const updatedBlocksWithTasks = await Promise.all(
    updatedBlocks.map(async (block) => {
      let task = null;
      if (block.taskId) {
        [task] = await db.select().from(tasks).where(eq(tasks.id, block.taskId)).limit(1);
      }
      return { ...block, task };
    })
  );

  // Publish realtime events for all updated blocks
  for (const block of updatedBlocks) {
    publishEvent(userId, 'timeblock:updated', {
      timeBlockId: block.id,
      date: block.date,
    });
  }

  return c.json({ success: true, data: updatedBlocksWithTasks, meta: { previous } });
});

/** DELETE /time-blocks/:id - Delete a time block */
timeBlocksRouter.delete('/:id', requireScopes('time-blocks:write'), zValidator('param', z.object({ id: uuidSchema })), async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.valid('param');
  const db = getDb();

  const [existing] = await db.select().from(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).limit(1);
  if (!existing) throw new NotFoundError('Time block', id);

  await db.delete(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId)));

  // Publish realtime event (fire and forget)
  publishEvent(userId, 'timeblock:deleted', {
    timeBlockId: id,
    date: existing.date,
  });

  return c.json({ success: true, message: 'Time block deleted successfully' });
});

export { timeBlocksRouter };
