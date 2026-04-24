import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";

export type MatchBreakdown = {
  matchId: string;
  opponentId: string;
  opponentName: string;
  won: boolean;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
};

/**
 * Group finished group-stage matches by player and express each one from that
 * player's perspective, so UI can explain how the aggregate Siege / Sätze /
 * Pkt numbers in the standings row were reached.
 */
export function computeBreakdownsByPlayer(
  matches: readonly Match[],
  sets: readonly MatchSetRow[],
  partsById: Map<string, Participant>,
): Map<string, MatchBreakdown[]> {
  const pointsByMatch = new Map<string, { a: number; b: number }>();
  for (const s of sets) {
    const cur = pointsByMatch.get(s.matchId) ?? { a: 0, b: 0 };
    cur.a += s.pointsA;
    cur.b += s.pointsB;
    pointsByMatch.set(s.matchId, cur);
  }

  const out = new Map<string, MatchBreakdown[]>();
  const push = (pid: string, entry: MatchBreakdown) => {
    const arr = out.get(pid) ?? [];
    arr.push(entry);
    out.set(pid, arr);
  };

  for (const m of matches) {
    if (m.status !== "finished") continue;
    if (!m.participantAId || !m.participantBId) continue;
    const pts = pointsByMatch.get(m.id) ?? { a: 0, b: 0 };
    const aWin = m.winnerParticipantId === m.participantAId;
    const bWin = m.winnerParticipantId === m.participantBId;
    const nameA = partsById.get(m.participantAId)?.name ?? "?";
    const nameB = partsById.get(m.participantBId)?.name ?? "?";

    push(m.participantAId, {
      matchId: m.id,
      opponentId: m.participantBId,
      opponentName: nameB,
      won: aWin,
      setsFor: m.setsA,
      setsAgainst: m.setsB,
      pointsFor: pts.a,
      pointsAgainst: pts.b,
    });
    push(m.participantBId, {
      matchId: m.id,
      opponentId: m.participantAId,
      opponentName: nameA,
      won: bWin,
      setsFor: m.setsB,
      setsAgainst: m.setsA,
      pointsFor: pts.b,
      pointsAgainst: pts.a,
    });
  }

  return out;
}
