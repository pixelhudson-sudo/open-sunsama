import { pgTable, uuid, varchar, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const scheduleTemplates = pgTable(
  'schedule_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    items: jsonb('items').notNull().$type<Array<{
      title: string;
      startTime: string;
      endTime: string;
      color: string | null;
      isBreak: boolean;
      isDurationLocked: boolean;
    }>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userTemplateNameIdx: uniqueIndex('schedule_templates_user_name_idx').on(table.userId, table.name),
  })
);

export const scheduleTemplatesRelations = relations(scheduleTemplates, ({ one }) => ({
  user: one(users, {
    fields: [scheduleTemplates.userId],
    references: [users.id],
  }),
}));

export type ScheduleTemplate = typeof scheduleTemplates.$inferSelect;
export type NewScheduleTemplate = typeof scheduleTemplates.$inferInsert;
