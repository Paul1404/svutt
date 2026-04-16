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
  /** Override rank-3 pool (otherwise computed from standings). */
  rank3Pool?: { playerId: PlayerId; groupLabel: string; row: StandingRow }[];
};

export type BuiltBracket = Bracket & {
  /** Standing tables used to seed the bracket. */
  standings: GroupStanding[];
  /** Lucky losers promoted into the bracket, in selection order. */
  luckyLosers: { playerId: PlayerId; groupLabel: string; rank3Score: number }[];
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
 * Build the full KO bracket from group results.
 *
 * Group winners get seeded by group position (A=0, B=1, …). If the number of
 * groups is not a power of two, the best Gruppendritten fill the missing
 * slots (Lucky Losers), ranked by wins → setDiff → pointDiff.
 *
 * Pairing rule (as specified): first half of slots plays second half —
 * slot[i] vs slot[i + size/2]. For 4 groups: (A vs C) and (B vs D).
 */
export function buildBracket(input: BracketInput): BuiltBracket {
  const standings = input.groups.map((g) => computeStandings(g));
  const numGroups = standings.length;

  if (numGroups === 0) {
    return { size: 0, matches: [], standings, luckyLosers: [] };
  }

  const size = nextPowerOfTwo(numGroups);
  const missing = size - numGroups;

  // Collect Lucky Loser candidates: the third-ranked player from every group.
  const pool = (input.rank3Pool ?? buildRank3Pool(standings)).slice();
  // Rank pool by wins desc → setDiff desc → pointDiff desc.
  pool.sort((x, y) => {
    if (y.row.wins !== x.row.wins) return y.row.wins - x.row.wins;
    if (y.row.setDiff !== x.row.setDiff) return y.row.setDiff - x.row.setDiff;
    if (y.row.pointDiff !== x.row.pointDiff)
      return y.row.pointDiff - x.row.pointDiff;
    return x.groupLabel.localeCompare(y.groupLabel);
  });

  const luckyLosers = pool.slice(0, missing);

  // Slot ordering: winners in group order, then lucky losers.
  const slots: BracketSlot[] = [];
  for (const s of standings) {
    const winner = s.rows[0];
    slots.push(
      winner
        ? {
            kind: "player",
            playerId: winner.playerId,
            source: { type: "winner", groupLabel: s.groupLabel },
          }
        : { kind: "empty" },
    );
  }
  for (const ll of luckyLosers) {
    slots.push({
      kind: "player",
      playerId: ll.playerId,
      source: {
        type: "luckyLoser",
        groupLabel: ll.groupLabel,
        groupRank: 3,
      },
    });
  }
  while (slots.length < size) slots.push({ kind: "empty" });

  // Build round 0 matches by pairing first-half vs second-half.
  const totalRounds = Math.log2(size);
  const matches: BracketMatch[] = [];
  const half = size / 2;
  const round0Ids: string[] = [];
  for (let i = 0; i < half; i++) {
    const id = matchId(0, i);
    round0Ids.push(id);
    matches.push({
      id,
      round: 0,
      matchIndex: i,
      label: labelForRound(0, totalRounds),
      a: slots[i] ?? { kind: "empty" },
      b: slots[i + half] ?? { kind: "empty" },
    });
  }

  // Subsequent rounds: winners of consecutive pairs meet.
  let prev = round0Ids;
  for (let r = 1; r < totalRounds; r++) {
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const id = matchId(r, i / 2);
      next.push(id);
      matches.push({
        id,
        round: r,
        matchIndex: i / 2,
        label: labelForRound(r, totalRounds),
        a: { kind: "pending", fromMatchId: prev[i]! },
        b: { kind: "pending", fromMatchId: prev[i + 1]! },
      });
    }
    prev = next;
  }

  return {
    size,
    matches,
    standings,
    luckyLosers: luckyLosers.map((l) => ({
      playerId: l.playerId,
      groupLabel: l.groupLabel,
      rank3Score: l.row.wins * 1000 + l.row.setDiff,
    })),
  };
}

export function buildRank3Pool(standings: GroupStanding[]): {
  playerId: PlayerId;
  groupLabel: string;
  row: StandingRow;
}[] {
  const pool: { playerId: PlayerId; groupLabel: string; row: StandingRow }[] =
    [];
  for (const s of standings) {
    const third = s.rows[2];
    if (third) {
      pool.push({
        playerId: third.playerId,
        groupLabel: s.groupLabel,
        row: third,
      });
    }
  }
  return pool;
}

function matchId(round: number, idx: number): string {
  return `ko-r${round}-m${idx}`;
}
