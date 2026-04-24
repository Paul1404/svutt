// -----------------------------------------------------------------------------
// Swiss-system tournament format plugin.
//
// Dutch pairing:
//   - Players are grouped by current score (1 point per win; draws not used).
//   - Within each score group, rank by (current score desc, Buchholz desc,
//     initial seed asc). The top half plays the bottom half.
//   - Floaters: if a score group has an odd size, the lowest-ranked player
//     floats down into the next group.
//   - No rematches: when the top/bottom split produces a rematch, swap the
//     bottom-half player with the next candidate until rematch-free (or no
//     legal pairing is possible - then we accept the best available).
//   - Byes: if the field is odd, one player gets a bye (1 point, no opponent)
//     each round. The lowest-ranked player who has not yet received a bye
//     takes it.
//
// Standings after the final round: primary by score (wins), tiebreakers are
// Buchholz (sum of opponents' scores), then Sonneborn-Berger, then seed.
// -----------------------------------------------------------------------------

import { computeMatchOutcome } from "./sets";
import type { SeededPlayer } from "./draw";
import { orderBySeed } from "./draw";
import type { Player, PlayerId, SetScore } from "./types";

export type SwissRoundMatch = {
  round: number;
  matchIndex: number;
  /** Match id unique within the category, stable across rebuilds. */
  id: string;
  a: PlayerId;
  /** `null` means player A received a bye this round. */
  b: PlayerId | null;
};

export type SwissRoundPlan = {
  round: number; // 0-based
  matches: SwissRoundMatch[];
  /** Player awarded the bye this round (if the field is odd). */
  byePlayerId: PlayerId | null;
};

export type SwissHistoryMatch = {
  round: number;
  a: PlayerId;
  b: PlayerId | null; // null = bye awarded to A
  sets: SetScore[];
};

export type SwissStandingRow = {
  playerId: PlayerId;
  seed: number; // 1-based initial seed
  matchesPlayed: number;
  wins: number;
  losses: number;
  byes: number;
  score: number; // wins + byes (1 point each)
  buchholz: number; // sum of opponents' scores
  sonnebornBerger: number; // sum of defeated opponents' scores
  setsWon: number;
  setsLost: number;
  setDiff: number;
  rank: number;
};

export type SwissStandings = {
  rows: SwissStandingRow[];
  /** `true` if every planned match has a valid completed outcome. */
  complete: boolean;
};

// ----------------------------- Pairing ---------------------------------------

export type SwissPairInput = {
  players: SeededPlayer[];
  /** All finished matches from previous rounds. Empty for round 0. */
  history?: readonly SwissHistoryMatch[];
};

/**
 * Produce the pairing for the next Swiss round. `history` covers all
 * previously played rounds (in chronological order). Returns matches for the
 * round AFTER the highest round in history (or round 0 if history is empty).
 */
export function planSwissRound(input: SwissPairInput): SwissRoundPlan {
  const history = input.history ?? [];
  const round = nextRoundNumber(history);

  // Seed order: seed asc, stable. This is also the tiebreak anchor.
  const ordered = orderBySeed(input.players);
  const seedOfPlayer = new Map<PlayerId, number>();
  ordered.forEach((p, i) => seedOfPlayer.set(p.id, i + 1));

  if (ordered.length === 0) {
    return { round, matches: [], byePlayerId: null };
  }

  // Compute current score + Buchholz for seeding the score groups.
  const stats = computeSwissStats(ordered, history);
  const scoreOf = (id: PlayerId) => stats.get(id)?.score ?? 0;
  const buchholzOf = (id: PlayerId) =>
    (stats.get(id)?.opponents ?? []).reduce(
      (acc, oid) => acc + scoreOf(oid),
      0,
    );

  // Sort by (score desc, buchholz desc, seed asc) for round > 0. For round 0,
  // pure seed order (top half vs bottom half).
  const sorted = ordered.slice().sort((a, b) => {
    const sa = stats.get(a.id)!;
    const sb = stats.get(b.id)!;
    if (sb.score !== sa.score) return sb.score - sa.score;
    const ba = buchholzOf(a.id);
    const bb = buchholzOf(b.id);
    if (bb !== ba) return bb - ba;
    return seedOfPlayer.get(a.id)! - seedOfPlayer.get(b.id)!;
  });

  // Decide who takes the bye first (odd field). Pick the lowest-ranked player
  // who has NOT yet received a bye in this tournament.
  const byeHistory = new Set<PlayerId>();
  for (const m of history) if (m.b === null) byeHistory.add(m.a);

  let pool = sorted.slice();
  let byePlayerId: PlayerId | null = null;
  if (pool.length % 2 === 1) {
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!byeHistory.has(pool[i]!.id)) {
        byePlayerId = pool[i]!.id;
        pool = [...pool.slice(0, i), ...pool.slice(i + 1)];
        break;
      }
    }
    if (byePlayerId === null) {
      // Everyone's already had a bye → give it to the lowest-ranked anyway.
      const last = pool[pool.length - 1]!;
      byePlayerId = last.id;
      pool = pool.slice(0, -1);
    }
  }

  // Group by current score (desc). Sorted already in desc score order so we
  // can scan sequentially.
  const groups: Player[][] = [];
  let current: Player[] = [];
  let currentScore = Number.POSITIVE_INFINITY;
  for (const p of pool) {
    const s = stats.get(p.id)!.score;
    if (s !== currentScore) {
      if (current.length > 0) groups.push(current);
      current = [];
      currentScore = s;
    }
    current.push(p);
  }
  if (current.length > 0) groups.push(current);

  // Dutch pairing within each score group, with floaters and rematch avoidance.
  const playedAgainst = buildPlayedAgainst(history);
  const matches: SwissRoundMatch[] = [];
  let carry: Player | null = null;
  let matchIndex = 0;

  const emit = (a: Player, b: Player) => {
    matches.push({
      round,
      matchIndex: matchIndex++,
      id: swissMatchId(round, matches.length),
      a: a.id,
      b: b.id,
    });
  };

  for (let gi = 0; gi < groups.length; gi++) {
    let g = groups[gi]!;
    if (carry) {
      g = [carry, ...g];
      carry = null;
    }
    if (g.length % 2 === 1) {
      // Float the lowest-ranked player in this group down.
      carry = g[g.length - 1]!;
      g = g.slice(0, -1);
    }
    // Dutch split: top half vs bottom half.
    const half = g.length / 2;
    const top = g.slice(0, half);
    const bot = g.slice(half);

    // Greedy rematch avoidance: for each `top[i]`, try `bot[i]` first; if
    // already played, swap with the next unpaired `bot[j]` that hasn't.
    const paired = new Array(bot.length).fill(false);
    for (let i = 0; i < top.length; i++) {
      const a = top[i]!;
      let chosen = i;
      if (paired[chosen] || hasPlayed(playedAgainst, a.id, bot[chosen]!.id)) {
        chosen = -1;
        for (let j = 0; j < bot.length; j++) {
          if (paired[j]) continue;
          if (!hasPlayed(playedAgainst, a.id, bot[j]!.id)) {
            chosen = j;
            break;
          }
        }
        if (chosen === -1) {
          // Accept any unpaired opponent (rematch allowed as last resort).
          chosen = paired.findIndex((x: boolean) => !x);
        }
      }
      paired[chosen] = true;
      emit(a, bot[chosen]!);
    }
  }

  if (carry) {
    // Odd total after all groups (shouldn't happen unless pool was odd) -
    // give carry a bye too. But we already handled bye at the top, so this
    // means we're left with a dangling floater: pair them against the first
    // legal opponent from a previous group.
    const fallback = pool.find((p) => p.id !== carry!.id);
    if (fallback) emit(carry, fallback);
  }

  return { round, matches, byePlayerId };
}

function buildPlayedAgainst(history: readonly SwissHistoryMatch[]) {
  const m = new Map<PlayerId, Set<PlayerId>>();
  const add = (x: PlayerId, y: PlayerId) => {
    let s = m.get(x);
    if (!s) {
      s = new Set();
      m.set(x, s);
    }
    s.add(y);
  };
  for (const h of history) {
    if (h.b === null) continue;
    add(h.a, h.b);
    add(h.b, h.a);
  }
  return m;
}

function hasPlayed(
  map: Map<PlayerId, Set<PlayerId>>,
  a: PlayerId,
  b: PlayerId,
): boolean {
  return map.get(a)?.has(b) ?? false;
}

function nextRoundNumber(history: readonly SwissHistoryMatch[]): number {
  if (history.length === 0) return 0;
  let max = -1;
  for (const h of history) if (h.round > max) max = h.round;
  return max + 1;
}

function swissMatchId(round: number, idx: number): string {
  return `sw-r${round}-m${idx}`;
}

// ----------------------------- Standings -------------------------------------

type PlayerStats = {
  score: number;
  opponents: PlayerId[];
  defeatedOpponents: PlayerId[];
  wins: number;
  losses: number;
  byes: number;
  setsWon: number;
  setsLost: number;
};

function computeSwissStats(
  players: readonly Player[],
  history: readonly SwissHistoryMatch[],
): Map<PlayerId, PlayerStats> {
  const stats = new Map<PlayerId, PlayerStats>();
  for (const p of players) {
    stats.set(p.id, {
      score: 0,
      opponents: [],
      defeatedOpponents: [],
      wins: 0,
      losses: 0,
      byes: 0,
      setsWon: 0,
      setsLost: 0,
    });
  }

  for (const h of history) {
    const a = stats.get(h.a);
    if (!a) continue;
    if (h.b === null) {
      // Bye: 1 point, no opponent. Count it as a win-like score for pairing.
      a.byes++;
      a.score++;
      continue;
    }
    const b = stats.get(h.b);
    if (!b) continue;
    a.opponents.push(h.b);
    b.opponents.push(h.a);
    const outcome = computeMatchOutcome(h.sets);
    if (!outcome.complete || !outcome.valid) continue;
    a.setsWon += outcome.setsA;
    a.setsLost += outcome.setsB;
    b.setsWon += outcome.setsB;
    b.setsLost += outcome.setsA;
    if (outcome.winner === "A") {
      a.wins++;
      a.score++;
      a.defeatedOpponents.push(h.b);
      b.losses++;
    } else if (outcome.winner === "B") {
      b.wins++;
      b.score++;
      b.defeatedOpponents.push(h.a);
      a.losses++;
    }
  }

  // Buchholz / Sonneborn-Berger are derived below (need the full score map).
  return stats;
}

/**
 * Compute the final standings of a Swiss tournament (or the intermediate
 * standings at any point). A tournament is "complete" when every non-bye
 * history match has a valid, finished outcome.
 */
export function computeSwissStandings(
  players: SeededPlayer[],
  history: readonly SwissHistoryMatch[],
): SwissStandings {
  const ordered = orderBySeed(players);
  const seedOfPlayer = new Map<PlayerId, number>();
  ordered.forEach((p, i) => seedOfPlayer.set(p.id, i + 1));

  const stats = computeSwissStats(ordered, history);
  const scoreOf = (id: PlayerId) => stats.get(id)?.score ?? 0;

  const rows: SwissStandingRow[] = ordered.map((p) => {
    const s = stats.get(p.id)!;
    const buchholz = s.opponents.reduce((acc, oid) => acc + scoreOf(oid), 0);
    const sb = s.defeatedOpponents.reduce(
      (acc, oid) => acc + scoreOf(oid),
      0,
    );
    return {
      playerId: p.id,
      seed: seedOfPlayer.get(p.id)!,
      matchesPlayed: s.wins + s.losses + s.byes,
      wins: s.wins,
      losses: s.losses,
      byes: s.byes,
      score: s.score,
      buchholz,
      sonnebornBerger: sb,
      setsWon: s.setsWon,
      setsLost: s.setsLost,
      setDiff: s.setsWon - s.setsLost,
      rank: 0,
    };
  });

  rows.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (y.buchholz !== x.buchholz) return y.buchholz - x.buchholz;
    if (y.sonnebornBerger !== x.sonnebornBerger)
      return y.sonnebornBerger - x.sonnebornBerger;
    if (y.setDiff !== x.setDiff) return y.setDiff - x.setDiff;
    return x.seed - y.seed;
  });
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  const complete = history.every((h) => {
    if (h.b === null) return true;
    const o = computeMatchOutcome(h.sets);
    return o.complete && o.valid;
  });

  return { rows, complete };
}

/** Suggested default round count: ceil(log2(N)), minimum 3. */
export function suggestedSwissRounds(playerCount: number): number {
  if (playerCount < 2) return 0;
  return Math.max(3, Math.ceil(Math.log2(playerCount)));
}
