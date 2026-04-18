ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "lucky_loser_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "set_points" integer DEFAULT 11 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "set_min_lead" integer DEFAULT 2 NOT NULL;
