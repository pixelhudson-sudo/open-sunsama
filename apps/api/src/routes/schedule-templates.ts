import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb, eq, and, scheduleTemplates, sql } from '@open-sunsama/database';
import { NotFoundError, uuidSchema } from '@open-sunsama/utils';
import { auth, requireScopes, type AuthVariables } from '../middleware/auth.js';

const scheduleTemplatesRouter = new Hono<{ Variables: AuthVariables }>();
scheduleTemplatesRouter.use('*', auth);

const templateItemSchema = z.object({
  title: z.string().max(255),
  startTime: z.string(),
  endTime: z.string(),
  color: z.string().nullable().optional(),
  isBreak: z.boolean().optional(),
  isDurationLocked: z.boolean().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(templateItemSchema),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  items: z.array(templateItemSchema).optional(),
});

/** GET /schedule-templates - List all templates for the current user */
scheduleTemplatesRouter.get('/', requireScopes('time-blocks:read'), async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const templates = await db
    .select({ id: scheduleTemplates.id, name: scheduleTemplates.name, createdAt: scheduleTemplates.createdAt })
    .from(scheduleTemplates)
    .where(eq(scheduleTemplates.userId, userId))
    .orderBy(scheduleTemplates.createdAt);
  return c.json({ success: true, data: templates });
});

/** GET /schedule-templates/:id - Get a single template with items */
scheduleTemplatesRouter.get('/:id', requireScopes('time-blocks:read'), zValidator('param', z.object({ id: uuidSchema })), async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.valid('param');
  const db = getDb();
  const [template] = await db
    .select()
    .from(scheduleTemplates)
    .where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, userId)))
    .limit(1);
  if (!template) throw new NotFoundError('Schedule template', id);
  return c.json({ success: true, data: template });
});

/** POST /schedule-templates - Create a new template */
scheduleTemplatesRouter.post('/', requireScopes('time-blocks:write'), zValidator('json', createTemplateSchema), async (c) => {
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = getDb();
  const [template] = await db.insert(scheduleTemplates).values({
    userId,
    name: data.name,
    items: data.items as never,
  }).returning();
  return c.json({ success: true, data: template }, 201);
});

/** PATCH /schedule-templates/:id - Rename a template */
scheduleTemplatesRouter.patch('/:id', requireScopes('time-blocks:write'), zValidator('param', z.object({ id: uuidSchema })), zValidator('json', updateTemplateSchema), async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');
  const db = getDb();
  const [existing] = await db.select().from(scheduleTemplates).where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, userId))).limit(1);
  if (!existing) throw new NotFoundError('Schedule template', id);
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.items !== undefined) updateData.items = updates.items as never;
  const [updated] = await db.update(scheduleTemplates).set(updateData).where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, userId))).returning();
  return c.json({ success: true, data: updated });
});

/** DELETE /schedule-templates/:id - Delete a template */
scheduleTemplatesRouter.delete('/:id', requireScopes('time-blocks:write'), zValidator('param', z.object({ id: uuidSchema })), async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.valid('param');
  const db = getDb();
  const [existing] = await db.select().from(scheduleTemplates).where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, userId))).limit(1);
  if (!existing) throw new NotFoundError('Schedule template', id);
  await db.delete(scheduleTemplates).where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, userId)));
  return c.json({ success: true, data: { id } });
});

export { scheduleTemplatesRouter };
