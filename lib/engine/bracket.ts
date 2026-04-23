import { computeStandings } from "./standings";
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
 * Seeding interleaves winners with runners-up in reverse group order so that
 * same-group players cannot meet in the first round (when advancementCount=2).
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
  const main = buildTree(mainEntries, "ko");

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
 * Seeds the main bracket. Slots go: winners in group order, then runners-up
 * in reverse group order, then 3rd-placers in group order, and so on. With
 * the "first half vs second half" pairing rule this keeps same-group players
 * on opposite ends of the bracket.
 */
function buildMainEntries(
  standings: GroupStanding[],
  advancementCount: number,
): BracketSlot[] {
  const slots: BracketSlot[] = [];
  for (let rank = 0; rank < advancementCount; rank++) {
    const order =
      rank % 2 === 0 ? standings : [...standings].reverse();
    for (const s of order) {
      const row = s.rows[rank];
      if (row) {
        slots.push({
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
        });
      } else {
        slots.push({ kind: "empty" });
      }
    }
  }
  return slots;
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
 * Build a single-elimination tree from a list of seeds. Empty slots are
 * appended to pad to the next power of two.
 *
 * A slot paired with an empty opponent is a "bye": no match is created for
 * that pair, and the filled player advances directly into the next round as
 * a real `player` slot. A pair where both slots are empty propagates as
 * empty — the downstream match either sees a bye of its own or is skipped
 * entirely when both sides are empty.
 */
function buildTree(seeds: readonly BracketSlot[], idPrefix: string): Bracket {
  const nonEmpty = seeds.length;
  if (nonEmpty === 0) return { size: 0, matches: [] };

  const size = nextPowerOfTwo(nonEmpty);
  const slots: BracketSlot[] = seeds.slice();
  while (slots.length < size) slots.push({ kind: "empty" });

  if (size === 1) return { size: 1, matches: [] };

  const totalRounds = Math.log2(size);
  const half = size / 2;
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
    if (aEmpty) return b;
    if (bEmpty) return a;
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

  // Round 0 uses "first half vs second half" pairing so same-group seeds
  // (who are placed at mirrored positions) stay on opposite ends of the
  // bracket.
  let feeds: BracketSlot[] = [];
  for (let i = 0; i < half; i++) {
    feeds.push(makeMatch(0, i, slots[i]!, slots[i + half]!));
  }

  // Rounds 1+ pair adjacent feeds.
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
