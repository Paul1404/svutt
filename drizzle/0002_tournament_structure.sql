-- Extend match_stage enum with "swiss" for Swiss-system matches.
ALTER TYPE "match_stage" ADD VALUE IF NOT EXISTS 'swiss';--> statement-breakpoint

-- Per-category tournament structure and draw mode.
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "structure" text DEFAULT 'groups_ko' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "draw_mode" text DEFAULT 'random' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "swiss_rounds" integer DEFAULT 5 NOT NULL;
