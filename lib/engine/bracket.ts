import { computeStandings } from "./standings";
import { seedingOrder } from "./koOnly";
import type {
  Bracket,
  BracketMatch,
  BracketSlot,
  EngineGroup,
  GroupStanding,
  PlayerId,
  StandingRow,
} from "./types";

export type BracketInput = {
  groups: readonly Pick<
    EngineGroup,
    "id" | "label" | "players" | "matches"
  >[];
  /**
   * How many players per group qualify for the main bracket (rank 1..N).
   * Default 2.
   */
  advancementCount?: number;
  /**
   * Whether a second consolation ("Lucky Loser") bracket is built from the
   * remaining, non-qualifying players. Defaults to true.
   */
  luckyLoserEnabled?: boolean;
};

type SeededEntry = {
  slot: BracketSlot;
  groupLabel: string;
  groupRank: number;
  /** Sort keys for seeding, best first. */
  wins: number;
  setDiff: number;
  pointDiff: number;
};

export type LuckyLoserEntry = {
  playerId: PlayerId;
  groupLabel: string;
  groupRank: number;
};

export type BuiltBracket = Bracket & {
  /** Standing tables used to seed the bracket. */
  standings: GroupStanding[];
  /**
   * Secondary ("Lucky Loser") bracket of non-qualifiers. `null` when disabled
   * or when there are fewer than two players eligible.
   */
  losers: Bracket | null;
  /** Players that ended up in the losers bracket, in seed order. */
  losersEntries: LuckyLoserEntry[];
};

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Flatten group standings into a map of participantId → {groupLabel, groupRank}.
 * Useful for labeling who came from which group in bracket views ("1. Gruppe A",
 * "3. Gruppe B", …). Rank is 1-based; rank 1 is the group winner.
 */
export function buildBracketOrigins(
  standings: readonly GroupStanding[],
): Map<PlayerId, { groupLabel: string; groupRank: number }> {
  const out = new Map<PlayerId, { groupLabel: string; groupRank: number }>();
  for (const s of standings) {
    for (const row of s.rows) {
      out.set(row.playerId, {
        groupLabel: s.groupLabel,
        groupRank: row.rank,
      });
    }
  }
  return out;
}

function labelForRound(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round - 1;
  if (fromEnd === 0) return "Finale";
  if (fromEnd === 1) return "Halbfinale";
  if (fromEnd === 2) return "Viertelfinale";
  if (fromEnd === 3) return "Achtelfinale";
  return `${round + 1}. Runde`;
}

/**
 * Build the main KO bracket + optional loser bracket from group results.
 *
 * Main bracket: the top `advancementCount` of every group (default 2).
 * Qualifiers are ranked globally by group rank, then wins / setDiff / pointDiff
 * and placed into classical seeding positions. That way byes always go to the
 * top seeds (the strongest qualifiers) and top seeds can only meet late in
 * the tree (1 vs 2 in the final, top 4 in the semis, etc.).
 *
 * Loser bracket: the remaining players (rank > advancementCount), seeded by
 * their standing row, best-to-worst.
 */
export function buildBracket(input: BracketInput): BuiltBracket {
  const standings = input.groups.map((g) => computeStandings(g));
  const numGroups = standings.length;
  const advancementCount = Math.max(1, input.advancementCount ?? 2);
  const luckyLoserEnabled = input.luckyLoserEnabled !== false;

  if (numGroups === 0) {
    return {
      size: 0,
      matches: [],
      standings,
      losers: null,
      losersEntries: [],
    };
  }

  // ---- Main bracket ----
  const mainEntries = buildMainEntries(standings, advancementCount);
  const main = buildTree(
    mainEntries.map((e) => e.slot),
    "ko",
  );

  // ---- Loser bracket ----
  const losersEntries: LuckyLoserEntry[] = luckyLoserEnabled
    ? buildLosersPool(standings, advancementCount)
    : [];
  const losers =
    luckyLoserEnabled && losersEntries.length >= 2
      ? buildTree(
          losersEntries.map((e) => ({
            kind: "player" as const,
            playerId: e.playerId,
            source: {
              type: "luckyLoser" as const,
              groupLabel: e.groupLabel,
              groupRank: e.groupRank,
            },
          })),
          "ll",
        )
      : null;

  return {
    size: main.size,
    matches: main.matches,
    standings,
    losers,
    losersEntries,
  };
}

/**
 * Rank the main-bracket qualifiers globally by strength so byes land on the
 * top seeds via classical seeding. Ordering: group rank asc (rank 1 before
 * rank 2), then wins / setDiff / pointDiff desc, stable by group label.
 *
 * Returns entries in seed order (best first). Empty entries are not
 * included; empty seeding positions are filled later by `buildTree` when
 * the qualifier count isn't a power of two.
 */
function buildMainEntries(
  standings: GroupStanding[],
  advancementCount: number,
): SeededEntry[] {
  const entries: SeededEntry[] = [];
  for (let rank = 0; rank < advancementCount; rank++) {
    for (const s of standings) {
      const row = s.rows[rank];
      if (!row) continue;
      entries.push({
        slot: {
          kind: "player",
          playerId: row.playerId,
          source:
            rank === 0
              ? { type: "winner", groupLabel: s.groupLabel }
              : {
                  type: "luckyLoser",
                  groupLabel: s.groupLabel,
                  groupRank: rank + 1,
                },
        },
        groupLabel: s.groupLabel,
        groupRank: rank + 1,
        wins: row.wins,
        setDiff: row.setDiff,
        pointDiff: row.pointDiff,
      });
    }
  }
  entries.sort((x, y) => {
    if (x.groupRank !== y.groupRank) return x.groupRank - y.groupRank;
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.setDiff !== x.setDiff) return y.setDiff - x.setDiff;
    if (y.pointDiff !== x.pointDiff) return y.pointDiff - x.pointDiff;
    return x.groupLabel.localeCompare(y.groupLabel);
  });
  return entries;
}

/**
 * Build the pool of non-qualifying players (rank > advancementCount) for the
 * loser bracket. Ranked across all groups by wins → setDiff → pointDiff, so
 * the best third-placers etc. are seeded at the top.
 */
function buildLosersPool(
  standings: GroupStanding[],
  advancementCount: number,
): LuckyLoserEntry[] {
  const pool: { entry: LuckyLoserEntry; row: StandingRow }[] = [];
  for (const s of standings) {
    for (let rank = advancementCount; rank < s.rows.length; rank++) {
      const row = s.rows[rank]!;
      pool.push({
        entry: {
          playerId: row.playerId,
          groupLabel: s.groupLabel,
          groupRank: rank + 1,
        },
        row,
      });
    }
  }
  pool.sort((x, y) => {
    if (y.row.wins !== x.row.wins) return y.row.wins - x.row.wins;
    if (y.row.setDiff !== x.row.setDiff) return y.row.setDiff - x.row.setDiff;
    if (y.row.pointDiff !== x.row.pointDiff)
      return y.row.pointDiff - x.row.pointDiff;
    return x.entry.groupLabel.localeCompare(y.entry.groupLabel);
  });
  return pool.map((p) => p.entry);
}

/**
 * Build a single-elimination tree from a strength-ranked seed list.
 *
 * Seeds are placed at classical bracket positions so that:
 *   - The top seed meets the bottom seed in round 0, seed 2 meets the
 *     second-worst seed, and so on (1-vs-N, 2-vs-(N-1), …).
 *   - Top seeds cannot meet until the final (seed 1 vs seed 2), top 4 not
 *     until the semifinal, etc.
 *   - Byes (empty seeds beyond the qualifier count) naturally land opposite
 *     the top seeds: with 10 qualifiers in a 16-bracket, the top 6 seeds
 *     get round-0 byes and only the bottom 4 play round 0.
 *
 * Round 0 always emits a match card for every real player (including byes
 * against empty slots) so no one visually skips the first round. Later
 * rounds collapse empty subtrees so we never paint phantom cards deep in
 * the tree.
 */
function buildTree(seeds: readonly BracketSlot[], idPrefix: string): Bracket {
  const nonEmpty = seeds.length;
  if (nonEmpty === 0) return { size: 0, matches: [] };

  const size = nextPowerOfTwo(nonEmpty);
  if (size === 1) return { size: 1, matches: [] };

  // Place seed k (0-based, best first) at its classical bracket position.
  // order[pos] = k means "seed k goes into bracket slot pos".
  const order = seedingOrder(size);
  const slots: BracketSlot[] = new Array(size);
  for (let pos = 0; pos < size; pos++) {
    const seedIdx = order[pos]!;
    slots[pos] = seeds[seedIdx] ?? { kind: "empty" };
  }

  const totalRounds = Math.log2(size);
  const matches: BracketMatch[] = [];

  const makeMatch = (
    round: number,
    matchIndex: number,
    a: BracketSlot,
    b: BracketSlot,
  ): BracketSlot => {
    const aEmpty = a.kind === "empty";
    const bEmpty = b.kind === "empty";
    if (aEmpty && bEmpty) return { kind: "empty" };
    if (round > 0) {
      if (aEmpty) return b;
      if (bEmpty) return a;
    }
    const id = matchId(idPrefix, round, matchIndex);
    matches.push({
      id,
      round,
      matchIndex,
      label: labelForRound(round, totalRounds),
      a,
      b,
    });
    return { kind: "pending", fromMatchId: id };
  };

  // Round 0: pair adjacent seed positions (classical 1-vs-N pairing).
  let feeds: BracketSlot[] = [];
  for (let i = 0; i < size / 2; i++) {
    feeds.push(makeMatch(0, i, slots[i * 2]!, slots[i * 2 + 1]!));
  }

  // Rounds 1+: pair adjacent winners from the previous round.
  for (let r = 1; r < totalRounds; r++) {
    const next: BracketSlot[] = [];
    for (let i = 0; i < feeds.length; i += 2) {
      next.push(makeMatch(r, i / 2, feeds[i]!, feeds[i + 1]!));
    }
    feeds = next;
  }

  return { size, matches };
}

function matchId(prefix: string, round: number, idx: number): string {
  return `${prefix}-r${round}-m${idx}`;
}
