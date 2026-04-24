-- Categories can be created as drafts (hidden from the public results page)
-- and later flipped to published. Existing rows keep their prior behaviour:
-- they default to published = true. From then on the column default is false
-- so newly created categories start as drafts until the admin publishes them.
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "published" boolean NOT NULL DEFAULT true;--> statement-breakpoint

ALTER TABLE "categories"
  ALTER COLUMN "published" SET DEFAULT false;
