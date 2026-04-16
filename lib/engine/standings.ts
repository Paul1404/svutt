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
 * Tie-breakers (in order, per Spec):
 *   1) wins (desc)
 *   2) setDiff (desc)
 *   3) pointDiff (desc)
 *   4) head-to-head wins (if only two tied)
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

  // Head-to-head map for 2-way ties: winsOverOpponent.get(a)?.get(b) = 1/0.
  const h2h = new Map<PlayerId, Map<PlayerId, number>>();
  const ensureH2H = (a: PlayerId): Map<PlayerId, number> => {
    let m = h2h.get(a);
    if (!m) {
      m = new Map();
      h2h.set(a, m);
    }
    return m;
  };

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
      ensureH2H(match.a).set(match.b, 1);
      ensureH2H(match.b).set(match.a, 0);
    } else if (outcome.winner === "B") {
      rowB.wins++;
      rowA.losses++;
      ensureH2H(match.b).set(match.a, 1);
      ensureH2H(match.a).set(match.b, 0);
    }
  }

  for (const row of byId.values()) {
    row.setDiff = row.setsWon - row.setsLost;
    row.pointDiff = row.pointsWon - row.pointsLost;
  }

  // Preserve insertion order for stable tie-breaking.
  const playerOrder = new Map<PlayerId, number>();
  group.players.forEach((p, i) => playerOrder.set(p.id, i));

  const rows = Array.from(byId.values());
  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.setDiff !== x.setDiff) return y.setDiff - x.setDiff;
    if (y.pointDiff !== x.pointDiff) return y.pointDiff - x.pointDiff;
    // Head-to-head only breaks ties when exactly two players share all above.
    const tiedCount = rows.filter(
      (r) =>
        r.wins === x.wins &&
        r.setDiff === x.setDiff &&
        r.pointDiff === x.pointDiff,
    ).length;
    if (tiedCount === 2) {
      const xOverY = h2h.get(x.playerId)?.get(y.playerId) ?? 0;
      const yOverX = h2h.get(y.playerId)?.get(x.playerId) ?? 0;
      if (xOverY !== yOverX) return yOverX - xOverY;
    }
    return (playerOrder.get(x.playerId) ?? 0) - (playerOrder.get(y.playerId) ?? 0);
  });

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
