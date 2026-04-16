// -----------------------------------------------------------------------------
// Pure domain types for the tournament engine.
// These are framework-agnostic and mirror the DB schema loosely.
// -----------------------------------------------------------------------------

export type PlayerId = string;

export type Player = {
  id: PlayerId;
  name: string;
  club?: string;
};

export type SetScore = {
  a: number;
  b: number;
};

export type MatchSideWinner = "A" | "B";

export type MatchOutcome = {
  /** `null` while the match is not yet decided. */
  winner: MatchSideWinner | null;
  setsA: number;
  setsB: number;
  /** Sum of points across all played sets. Useful for standings tie-breakers. */
  pointsA: number;
  pointsB: number;
  /** `true` once winSets is reached — i.e. the match is decided. */
  complete: boolean;
  /** `true` when all sets individually pass the TT set-validity rules. */
  valid: boolean;
};

export type EngineMatch = {
  id: string;
  a: PlayerId | null;
  b: PlayerId | null;
  sets: SetScore[];
};

export type EngineGroup = {
  id: string;
  label: string; // "A", "B", ...
  players: Player[];
  matches: EngineMatch[];
};

export type StandingRow = {
  playerId: PlayerId;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  pointsWon: number;
  pointsLost: number;
  pointDiff: number;
  rank: number; // 1-based
  /** `true` if this row was broken by coin-flip / stable sort only (tie). */
  tied: boolean;
};

export type GroupStanding = {
  groupId: string;
  groupLabel: string;
  rows: StandingRow[];
};

export type BracketSlot =
  | { kind: "player"; playerId: PlayerId; source: BracketSlotSource }
  | { kind: "pending"; fromMatchId: string }
  | { kind: "empty" };

export type BracketSlotSource =
  | { type: "winner"; groupLabel: string }
  | { type: "luckyLoser"; groupLabel: string; groupRank: number };

export type BracketMatch = {
  id: string;
  round: number; // 0 = first round
  matchIndex: number; // position within round
  label: string; // "Finale", "Halbfinale", "Viertelfinale", "1. Runde"
  a: BracketSlot;
  b: BracketSlot;
  /** IDs of the matches whose winners feed into A / B in the next round. */
  feedsInto?: { matchId: string; side: MatchSideWinner } | null;
};

export type Bracket = {
  size: number; // always a power of two
  matches: BracketMatch[];
};

export type ScheduleConfig = {
  /** "HH:MM" format, local time. */
  startTime: string;
  parallelTables: number;
  matchDurationMinutes: number;
};

export type ScheduledMatch = {
  matchId: string;
  playOrder: number;
  tableNumber: number;
  /** Minutes since tournament start. */
  minuteOffset: number;
  /** "HH:MM" */
  wallClock: string;
};
