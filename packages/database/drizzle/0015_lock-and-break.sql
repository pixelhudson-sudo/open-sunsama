ALTER TABLE "time_blocks" ADD COLUMN "is_duration_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "is_break" boolean DEFAULT false NOT NULL;