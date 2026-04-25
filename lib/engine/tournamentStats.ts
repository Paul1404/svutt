import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";

/**
 * Per-player aggregate stats across the whole category. Differs from the
 * group `StandingRow` in that it spans every stage (group, KO, swiss) and
 * tracks colourful metrics — clean sweeps, comebacks, bagels — that are fun
 * to display in a stats panel but are not used for ranking.
 */
export type PlayerStat = {
  participantId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  pointsWon: number;
  pointsLost: number;
  pointDiff: number;
  /** Wins without dropping a single set. */
  cleanSweeps: number;
  /** Wins after losing the first set. */
  comebacks: number;
  /** Sets won where opponent scored 0 ("bagel"). */
  bagelsFor: number;
  /** Sets lost where this player scored 0. */
  bagelsAgainst: number;
  /** Sets won at deuce (winner above the regular setPoints threshold). */
  deuceSetsWon: number;
};

export type MatchHighlight = {
  matchId: string;
  participantAId: string;
  participantBId: string;
  setsA: number;
  setsB: number;
  pointsA: number;
  pointsB: number;
  totalPoints: number;
  pointMargin: number;
};

export type SetHighlight = {
  matchId: string;
  setNumber: number;
  pointsA: number;
  pointsB: number;
  participantAId: string;
  participantBId: string;
  /** Side that won this individual set. */
  winnerSide: "A" | "B";
  totalPoints: number;
};

export type TournamentStats = {
  totalMatches: number;
  finishedMatches: number;
  totalSetsPlayed: number;
  totalPointsPlayed: number;
  /** Average points per *set* across all played sets. */
  averagePointsPerSet: number;
  /** Number of sets where a player scored 0. */
  bagelSetsCount: number;
  /** Number of sets that went to deuce. */
  deuceSetsCount: number;
  longestMatch: MatchHighlight | null;
  closestMatch: MatchHighlight | null;
  biggestBlowout: MatchHighlight | null;
  longestSet: SetHighlight | null;
  perPlayer: PlayerStat[];
};

export function computeTournamentStats(
  matches: readonly Match[],
  sets: readonly MatchSetRow[],
  participants: readonly Participant[],
  setPoints: number,
): TournamentStats {
  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const s of sets) {
    const arr = setsByMatch.get(s.matchId) ?? [];
    arr.push(s);
    setsByMatch.set(s.matchId, arr);
  }
  for (const arr of setsByMatch.values()) {
    arr.sort((a, b) => a.setNumber - b.setNumber);
  }

  const stats = new Map<string, PlayerStat>();
  for (const p of participants) {
    stats.set(p.id, {
      participantId: p.id,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      pointsWon: 0,
      pointsLost: 0,
      pointDiff: 0,
      cleanSweeps: 0,
      comebacks: 0,
      bagelsFor: 0,
      bagelsAgainst: 0,
      deuceSetsWon: 0,
    });
  }

  let totalSetsPlayed = 0;
  let totalPointsPlayed = 0;
  let bagelSetsCount = 0;
  let deuceSetsCount = 0;
  let longestMatch: MatchHighlight | null = null;
  let closestMatch: MatchHighlight | null = null;
  let biggestBlowout: MatchHighlight | null = null;
  let longestSet: SetHighlight | null = null;
  let finishedMatches = 0;

  for (const m of matches) {
    if (
      m.status !== "finished" ||
      !m.participantAId ||
      !m.participantBId ||
      !m.winnerParticipantId
    ) {
      continue;
    }
    finishedMatches++;
    const aId = m.participantAId;
    const bId = m.participantBId;
    const a = stats.get(aId);
    const b = stats.get(bId);
    if (!a || !b) continue;

    const ms = setsByMatch.get(m.id) ?? [];
    let pointsA = 0;
    let pointsB = 0;
    let firstSetWinner: "A" | "B" | null = null;

    for (const s of ms) {
      pointsA += s.pointsA;
      pointsB += s.pointsB;
      totalSetsPlayed++;
      const totalSetPoints = s.pointsA + s.pointsB;
      totalPointsPlayed += totalSetPoints;

      const winnerSide: "A" | "B" = s.pointsA > s.pointsB ? "A" : "B";
      if (firstSetWinner === null) firstSetWinner = winnerSide;

      if (s.pointsA === 0 || s.pointsB === 0) {
        bagelSetsCount++;
        if (s.pointsA === 0) {
          a.bagelsAgainst++;
          b.bagelsFor++;
        } else {
          b.bagelsAgainst++;
          a.bagelsFor++;
        }
      }

      const setMax = Math.max(s.pointsA, s.pointsB);
      if (setMax > setPoints) {
        deuceSetsCount++;
        if (winnerSide === "A") a.deuceSetsWon++;
        else b.deuceSetsWon++;
      }

      if (!longestSet || totalSetPoints > longestSet.totalPoints) {
        longestSet = {
          matchId: m.id,
          setNumber: s.setNumber,
          pointsA: s.pointsA,
          pointsB: s.pointsB,
          participantAId: aId,
          participantBId: bId,
          winnerSide,
          totalPoints: totalSetPoints,
        };
      }
    }

    a.matchesPlayed++;
    b.matchesPlayed++;
    a.setsWon += m.setsA;
    a.setsLost += m.setsB;
    b.setsWon += m.setsB;
    b.setsLost += m.setsA;
    a.pointsWon += pointsA;
    a.pointsLost += pointsB;
    b.pointsWon += pointsB;
    b.pointsLost += pointsA;

    const aWon = m.winnerParticipantId === aId;
    if (aWon) {
      a.wins++;
      b.losses++;
      if (m.setsB === 0) a.cleanSweeps++;
      if (firstSetWinner === "B") a.comebacks++;
    } else {
      b.wins++;
      a.losses++;
      if (m.setsA === 0) b.cleanSweeps++;
      if (firstSetWinner === "A") b.comebacks++;
    }

    const totalMatchPoints = pointsA + pointsB;
    const margin = Math.abs(pointsA - pointsB);
    const highlight: MatchHighlight = {
      matchId: m.id,
      participantAId: aId,
      participantBId: bId,
      setsA: m.setsA,
      setsB: m.setsB,
      pointsA,
      pointsB,
      totalPoints: totalMatchPoints,
      pointMargin: margin,
    };
    if (!longestMatch || totalMatchPoints > longestMatch.totalPoints) {
      longestMatch = highlight;
    }
    if (!closestMatch || margin < closestMatch.pointMargin) {
      closestMatch = highlight;
    }
    if (!biggestBlowout || margin > biggestBlowout.pointMargin) {
      biggestBlowout = highlight;
    }
  }

  for (const s of stats.values()) {
    s.setDiff = s.setsWon - s.setsLost;
    s.pointDiff = s.pointsWon - s.pointsLost;
    s.winRate = s.matchesPlayed > 0 ? s.wins / s.matchesPlayed : 0;
  }

  const perPlayer = Array.from(stats.values()).filter(
    (s) => s.matchesPlayed > 0,
  );

  return {
    totalMatches: matches.length,
    finishedMatches,
    totalSetsPlayed,
    totalPointsPlayed,
    averagePointsPerSet:
      totalSetsPlayed > 0 ? totalPointsPlayed / totalSetsPlayed : 0,
    bagelSetsCount,
    deuceSetsCount,
    longestMatch,
    closestMatch,
    biggestBlowout,
    longestSet,
    perPlayer,
  };
}

export type LeaderboardEntry = {
  player: PlayerStat;
  value: number;
};

/**
 * Pick the top N players by a numeric extractor, dropping zero values so the
 * panel never advertises "Most comebacks: 0". Stable ties on extractor value
 * are broken by win count so a 5-1 player edges a 1-1 player on win-rate
 * podiums.
 */
export function topBy(
  stats: PlayerStat[],
  extract: (s: PlayerStat) => number,
  limit = 3,
  options: { minMatches?: number; allowZero?: boolean } = {},
): LeaderboardEntry[] {
  const min = options.minMatches ?? 0;
  const allowZero = options.allowZero ?? false;
  return stats
    .filter((s) => s.matchesPlayed >= min)
    .map((s) => ({ player: s, value: extract(s) }))
    .filter((e) => allowZero || e.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.player.wins !== a.player.wins)
        return b.player.wins - a.player.wins;
      return b.player.setDiff - a.player.setDiff;
    })
    .slice(0, limit);
}
