-- Lucky-loser reloaded: add a second bracket stage for non-qualifiers.
ALTER TYPE "match_stage" ADD VALUE IF NOT EXISTS 'ko_losers';--> statement-breakpoint

-- Configurable group-advancement count (top N per group go to the main bracket).
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "group_advancement_count" integer DEFAULT 2 NOT NULL;--> statement-breakpoint

-- Drop wall-clock scheduling: tournaments no longer have a fixed start time
-- and matches no longer carry a scheduled_at timestamp. We only keep
-- play_order + table_number so matches still know where to land.
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "start_time";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN IF EXISTS "scheduled_at";
