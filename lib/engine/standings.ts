import { computeMatchOutcome } from "./sets";
import type {
  EngineGroup,
  EngineMatch,
  GroupStanding,
  Player,
  PlayerId,
  StandingRow,
} from "./types";

/**
 * Compute the standings table for a group. Completed matches count towards
 * stats; unfinished matches are ignored.
 *
 * Tie-breakers (in order):
 *   1) wins (desc)
 *   2) head-to-head sub-table among everyone tied on wins:
 *        sub-wins desc → sub-setDiff desc → sub-pointDiff desc
 *      Recursed on any subset that remains tied after the sub-table, so
 *      eliminating a player from the tied set re-computes the sub-table
 *      among the remaining ones (ITTF-style).
 *   3) overall setDiff (desc)
 *   4) overall pointDiff (desc)
 *   5) original seeding / insertion order (stable)
 */
export function computeStandings(
  group: Pick<EngineGroup, "id" | "label" | "players" | "matches">,
): GroupStanding {
  const byId = new Map<PlayerId, StandingRow>(
    group.players.map((p) => [
      p.id,
      {
        playerId: p.id,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        setDiff: 0,
        pointsWon: 0,
        pointsLost: 0,
        pointDiff: 0,
        rank: 0,
        tied: false,
      },
    ]),
  );

  for (const match of group.matches) {
    if (!match.a || !match.b) continue;
    const outcome = computeMatchOutcome(match.sets);
    if (!outcome.complete || !outcome.valid) continue;
    const rowA = byId.get(match.a);
    const rowB = byId.get(match.b);
    if (!rowA || !rowB) continue;

    rowA.matchesPlayed++;
    rowB.matchesPlayed++;
    rowA.setsWon += outcome.setsA;
    rowA.setsLost += outcome.setsB;
    rowB.setsWon += outcome.setsB;
    rowB.setsLost += outcome.setsA;
    rowA.pointsWon += outcome.pointsA;
    rowA.pointsLost += outcome.pointsB;
    rowB.pointsWon += outcome.pointsB;
    rowB.pointsLost += outcome.pointsA;

    if (outcome.winner === "A") {
      rowA.wins++;
      rowB.losses++;
    } else if (outcome.winner === "B") {
      rowB.wins++;
      rowA.losses++;
    }
  }

  for (const row of byId.values()) {
    row.setDiff = row.setsWon - row.setsLost;
    row.pointDiff = row.pointsWon - row.pointsLost;
  }

  // Preserve insertion order for stable tie-breaking.
  const playerOrder = new Map<PlayerId, number>();
  group.players.forEach((p, i) => playerOrder.set(p.id, i));

  type SubStat = { wins: number; setDiff: number; pointDiff: number };
  const subTableStats = (ids: ReadonlySet<PlayerId>): Map<PlayerId, SubStat> => {
    const stats = new Map<PlayerId, SubStat>();
    for (const id of ids) stats.set(id, { wins: 0, setDiff: 0, pointDiff: 0 });
    for (const match of group.matches) {
      if (!match.a || !match.b) continue;
      if (!ids.has(match.a) || !ids.has(match.b)) continue;
      const outcome = computeMatchOutcome(match.sets);
      if (!outcome.complete || !outcome.valid) continue;
      const sa = stats.get(match.a)!;
      const sb = stats.get(match.b)!;
      sa.setDiff += outcome.setsA - outcome.setsB;
      sb.setDiff += outcome.setsB - outcome.setsA;
      sa.pointDiff += outcome.pointsA - outcome.pointsB;
      sb.pointDiff += outcome.pointsB - outcome.pointsA;
      if (outcome.winner === "A") sa.wins++;
      else if (outcome.winner === "B") sb.wins++;
    }
    return stats;
  };

  const overallFallback = (group: StandingRow[]): StandingRow[] =>
    [...group].sort((x, y) => {
      if (y.setDiff !== x.setDiff) return y.setDiff - x.setDiff;
      if (y.pointDiff !== x.pointDiff) return y.pointDiff - x.pointDiff;
      return (
        (playerOrder.get(x.playerId) ?? 0) -
        (playerOrder.get(y.playerId) ?? 0)
      );
    });

  const breakTie = (tied: StandingRow[]): StandingRow[] => {
    if (tied.length <= 1) return tied;
    const ids = new Set(tied.map((r) => r.playerId));
    const sub = subTableStats(ids);
    const sorted = [...tied].sort((x, y) => {
      const sx = sub.get(x.playerId)!;
      const sy = sub.get(y.playerId)!;
      if (sy.wins !== sx.wins) return sy.wins - sx.wins;
      if (sy.setDiff !== sx.setDiff) return sy.setDiff - sx.setDiff;
      if (sy.pointDiff !== sx.pointDiff) return sy.pointDiff - sx.pointDiff;
      return 0;
    });
    const result: StandingRow[] = [];
    let i = 0;
    while (i < sorted.length) {
      const sx = sub.get(sorted[i]!.playerId)!;
      let j = i + 1;
      while (j < sorted.length) {
        const sy = sub.get(sorted[j]!.playerId)!;
        if (
          sx.wins !== sy.wins ||
          sx.setDiff !== sy.setDiff ||
          sx.pointDiff !== sy.pointDiff
        )
          break;
        j++;
      }
      const subGroup = sorted.slice(i, j);
      if (subGroup.length === 1) {
        result.push(subGroup[0]!);
      } else if (subGroup.length < tied.length) {
        // Sub-table separated some players; recurse on the still-tied subset
        // so its sub-table is recomputed without the now-resolved players.
        result.push(...breakTie(subGroup));
      } else {
        // Sub-table made no progress; fall back to overall stats.
        result.push(...overallFallback(subGroup));
      }
      i = j;
    }
    return result;
  };

  const rows = Array.from(byId.values());
  rows.sort((a, b) => b.wins - a.wins);
  const ranked: StandingRow[] = [];
  let cursor = 0;
  while (cursor < rows.length) {
    let end = cursor + 1;
    while (end < rows.length && rows[end]!.wins === rows[cursor]!.wins) end++;
    ranked.push(...breakTie(rows.slice(cursor, end)));
    cursor = end;
  }
  rows.length = 0;
  rows.push(...ranked);

  // Mark ties + assign ranks.
  rows.forEach((row, i) => {
    row.rank = i + 1;
    const prev = rows[i - 1];
    const next = rows[i + 1];
    const sameAs = (o?: StandingRow) =>
      !!o &&
      o.wins === row.wins &&
      o.setDiff === row.setDiff &&
      o.pointDiff === row.pointDiff;
    row.tied = sameAs(prev) || sameAs(next);
  });

  return {
    groupId: group.id,
    groupLabel: group.label,
    rows,
  };
}

/**
 * Helper: compute standings for many groups at once.
 */
export function computeAllStandings(
  groups: readonly Pick<
    EngineGroup,
    "id" | "label" | "players" | "matches"
  >[],
): GroupStanding[] {
  return groups.map(computeStandings);
}

/**
 * `true` if every match of the group has a valid, complete outcome.
 */
export function isGroupComplete(group: {
  matches: readonly EngineMatch[];
  players: readonly Player[];
}): boolean {
  const expected = (group.players.length * (group.players.length - 1)) / 2;
  let complete = 0;
  for (const m of group.matches) {
    const r = computeMatchOutcome(m.sets);
    if (r.complete && r.valid) complete++;
  }
  return complete >= expected;
}
