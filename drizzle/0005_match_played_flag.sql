-- Admin-only UI hint: marks a group-phase match as already played even when
-- no result has been entered. Defaults to false; no game logic depends on it.
ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "played" boolean NOT NULL DEFAULT false;
