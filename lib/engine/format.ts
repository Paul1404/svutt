// -----------------------------------------------------------------------------
// Shared types for tournament-format plugins.
//
// A "format" is a pluggable strategy that decides how a category's matches are
// generated (plan), how standings are computed, and — for Swiss — how
// subsequent rounds are built from finished ones (advance).
//
// Each format lives in its own module (swiss.ts, koOnly.ts, roundRobinOnly.ts,
// plus the implicit groups_ko built from draw.ts + roundRobin.ts + bracket.ts)
// and exports plain functions. The API handler inspects the category's
// `structure` column and dispatches to the matching plugin.
// -----------------------------------------------------------------------------

export const TOURNAMENT_STRUCTURES = [
  "groups_ko",
  "round_robin",
  "ko_only",
  "swiss",
] as const;
export type TournamentStructure = (typeof TOURNAMENT_STRUCTURES)[number];

export const DRAW_MODES = [
  "random",
  "seeded_snake",
  "paste_order",
  "manual",
] as const;
export type DrawMode = (typeof DRAW_MODES)[number];

export function isTournamentStructure(v: unknown): v is TournamentStructure {
  return (
    typeof v === "string" &&
    (TOURNAMENT_STRUCTURES as readonly string[]).includes(v)
  );
}

export function isDrawMode(v: unknown): v is DrawMode {
  return typeof v === "string" && (DRAW_MODES as readonly string[]).includes(v);
}

/** Minimum participants required to run each structure. */
export const MIN_PARTICIPANTS: Record<TournamentStructure, number> = {
  groups_ko: 4,
  round_robin: 2,
  ko_only: 2,
  swiss: 2,
};

/** Human-readable German labels for the UI. */
export const STRUCTURE_LABELS: Record<TournamentStructure, string> = {
  groups_ko: "Gruppen → KO",
  round_robin: "Jeder gegen jeden",
  ko_only: "KO-System",
  swiss: "Schweizer System",
};

export const DRAW_MODE_LABELS: Record<DrawMode, string> = {
  random: "Zufällig",
  seeded_snake: "Gesetzt (Schlange)",
  paste_order: "Listenreihenfolge",
  manual: "Manuell",
};
