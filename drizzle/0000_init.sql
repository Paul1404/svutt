CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'running', 'finished');--> statement-breakpoint
CREATE TYPE "public"."match_stage" AS ENUM('group', 'ko');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'in_progress', 'finished');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"start_date" timestamp with time zone,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"start_time" text DEFAULT '10:00' NOT NULL,
	"parallel_tables" integer DEFAULT 3 NOT NULL,
	"match_duration_minutes" integer DEFAULT 11 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournaments_slug_idx" ON "tournaments" ("slug");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"group_size" integer DEFAULT 4 NOT NULL,
	"win_sets" integer DEFAULT 2 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"draw_done" boolean DEFAULT false NOT NULL,
	"bracket_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_tournament_idx" ON "categories" ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_tournament_slug_idx" ON "categories" ("tournament_id", "slug");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"club" text,
	"seed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "participants_category_idx" ON "participants" ("category_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
	"label" text NOT NULL,
	"position" integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "groups_category_idx" ON "groups" ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "groups_category_label_idx" ON "groups" ("category_id", "label");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_members" (
	"group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
	"participant_id" uuid NOT NULL REFERENCES "participants"("id") ON DELETE CASCADE,
	"position" integer NOT NULL,
	CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "participant_id")
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_members_participant_idx" ON "group_members" ("participant_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
	"stage" "match_stage" NOT NULL,
	"group_id" uuid REFERENCES "groups"("id") ON DELETE CASCADE,
	"round" integer NOT NULL,
	"match_index" integer NOT NULL,
	"participant_a_id" uuid REFERENCES "participants"("id") ON DELETE SET NULL,
	"participant_b_id" uuid REFERENCES "participants"("id") ON DELETE SET NULL,
	"source_match_a_id" uuid,
	"source_match_b_id" uuid,
	"ko_label" text,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"sets_a" integer DEFAULT 0 NOT NULL,
	"sets_b" integer DEFAULT 0 NOT NULL,
	"winner_participant_id" uuid REFERENCES "participants"("id") ON DELETE SET NULL,
	"table_number" integer,
	"scheduled_at" timestamp with time zone,
	"play_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_category_idx" ON "matches" ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_group_idx" ON "matches" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_stage_idx" ON "matches" ("category_id", "stage");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "match_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
	"set_number" integer NOT NULL,
	"points_a" integer NOT NULL,
	"points_b" integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_sets_match_idx" ON "match_sets" ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_sets_unique_idx" ON "match_sets" ("match_id", "set_number");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
