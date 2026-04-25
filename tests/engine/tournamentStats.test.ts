import { describe, expect, it } from "vitest";
import { computeTournamentStats, topBy } from "@/lib/engine/tournamentStats";
import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";

function participant(id: string, name: string): Participant {
  return {
    id,
    categoryId: "cat",
    name,
    club: null,
    seed: null,
    createdAt: new Date(),
  };
}

function match(
  id: string,
  aId: string,
  bId: string,
  setsA: number,
  setsB: number,
  winnerId: string,
  status: "finished" | "pending" = "finished",
): Match {
  return {
    id,
    categoryId: "cat",
    stage: "group",
    groupId: null,
    round: 0,
    matchIndex: 0,
    participantAId: aId,
    participantBId: bId,
    sourceMatchAId: null,
    sourceMatchBId: null,
    koLabel: null,
    status,
    setsA,
    setsB,
    winnerParticipantId: winnerId,
    tableNumber: null,
    playOrder: null,
    played: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function set(
  matchId: string,
  setNumber: number,
  pointsA: number,
  pointsB: number,
): MatchSetRow {
  return { id: `${matchId}-s${setNumber}`, matchId, setNumber, pointsA, pointsB };
}

describe("computeTournamentStats", () => {
  it("aggregates wins, points, and clean sweeps across matches", () => {
    const [a, b, c] = [
      participant("a", "Alice"),
      participant("b", "Bob"),
      participant("c", "Carol"),
    ];
    const matches: Match[] = [
      match("m1", "a", "b", 2, 0, "a"),
      match("m2", "a", "c", 2, 1, "a"),
      match("m3", "b", "c", 2, 0, "b"),
    ];
    const sets: MatchSetRow[] = [
      // m1: Alice sweeps Bob
      set("m1", 1, 11, 4),
      set("m1", 2, 11, 6),
      // m2: Alice loses set 1 then comes back
      set("m2", 1, 9, 11),
      set("m2", 2, 11, 8),
      set("m2", 3, 12, 10), // deuce
      // m3: Bob sweeps Carol with a bagel set
      set("m3", 1, 11, 0),
      set("m3", 2, 11, 7),
    ];

    const stats = computeTournamentStats(matches, sets, [a, b, c], 11);

    expect(stats.finishedMatches).toBe(3);
    expect(stats.totalSetsPlayed).toBe(7);
    expect(stats.bagelSetsCount).toBe(1);
    expect(stats.deuceSetsCount).toBe(1);

    const alice = stats.perPlayer.find((p) => p.participantId === "a")!;
    expect(alice.wins).toBe(2);
    expect(alice.losses).toBe(0);
    expect(alice.cleanSweeps).toBe(1);
    expect(alice.comebacks).toBe(1);
    expect(alice.deuceSetsWon).toBe(1);

    const bob = stats.perPlayer.find((p) => p.participantId === "b")!;
    expect(bob.wins).toBe(1);
    expect(bob.bagelsFor).toBe(1);

    const carol = stats.perPlayer.find((p) => p.participantId === "c")!;
    expect(carol.bagelsAgainst).toBe(1);
    expect(carol.wins).toBe(0);
  });

  it("identifies closest match, biggest blowout and longest match", () => {
    const players = [
      participant("a", "A"),
      participant("b", "B"),
      participant("c", "C"),
    ];
    const matches: Match[] = [
      match("close", "a", "b", 2, 1, "a"),
      match("blow", "a", "c", 2, 0, "a"),
      match("long", "b", "c", 2, 1, "b"),
    ];
    const sets: MatchSetRow[] = [
      // close: 1-point margin overall
      set("close", 1, 11, 9),
      set("close", 2, 9, 11),
      set("close", 3, 11, 10), // invalid in real life but useful for margin testing
      // blowout: huge margin
      set("blow", 1, 11, 1),
      set("blow", 2, 11, 2),
      // long: lots of points
      set("long", 1, 13, 11),
      set("long", 2, 9, 11),
      set("long", 3, 14, 12),
    ];

    const stats = computeTournamentStats(matches, sets, players, 11);
    expect(stats.closestMatch?.matchId).toBe("close");
    expect(stats.biggestBlowout?.matchId).toBe("blow");
    expect(stats.longestMatch?.matchId).toBe("long");
    expect(stats.longestSet?.matchId).toBe("long");
  });

  it("ignores unfinished matches", () => {
    const players = [participant("a", "A"), participant("b", "B")];
    const matches: Match[] = [
      match("m1", "a", "b", 0, 0, "", "pending"),
    ];
    // Override the synthetic empty winnerId to a real null since the helper
    // forces a string; the production code expects null here.
    matches[0]!.winnerParticipantId = null;
    const stats = computeTournamentStats(matches, [], players, 11);
    expect(stats.finishedMatches).toBe(0);
    expect(stats.perPlayer).toHaveLength(0);
  });
});

describe("topBy", () => {
  it("filters out zero values by default and ranks descending", () => {
    const [a, b, c] = [
      participant("a", "A"),
      participant("b", "B"),
      participant("c", "C"),
    ];
    const matches: Match[] = [
      match("m1", "a", "b", 2, 0, "a"),
      match("m2", "a", "c", 2, 0, "a"),
    ];
    const sets: MatchSetRow[] = [
      set("m1", 1, 11, 5),
      set("m1", 2, 11, 5),
      set("m2", 1, 11, 5),
      set("m2", 2, 11, 5),
    ];
    const stats = computeTournamentStats(matches, sets, [a, b, c], 11);
    const top = topBy(stats.perPlayer, (s) => s.wins);
    expect(top.map((e) => e.player.participantId)).toEqual(["a"]);
  });
});
