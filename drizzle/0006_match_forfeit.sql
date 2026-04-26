-- Records which player was disqualified when an admin ends a match by DQ.
-- Nullable; the existing winner_participant_id still points at the winner.
ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "forfeited_by" uuid;

ALTER TABLE "matches"
  ADD CONSTRAINT "matches_forfeited_by_participants_id_fk"
  FOREIGN KEY ("forfeited_by") REFERENCES "participants"("id")
  ON DELETE SET NULL;
