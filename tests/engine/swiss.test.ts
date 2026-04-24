import { describe, expect, it } from "vitest";
import {
  computeSwissStandings,
  planSwissRound,
  suggestedSwissRounds,
  type SwissHistoryMatch,
} from "@/lib/engine/swiss";
import type { SeededPlayer } from "@/lib/engine/draw";
import type { SetScore } from "@/lib/engine/types";

function seeded(count: number): SeededPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    seed: i + 1,
  }));
}

/** A completed straight-sets win for A. */
function winA(): SetScore[] {
  return [
    { a: 11, b: 5 },
    { a: 11, b: 7 },
  ];
}
/** A completed straight-sets win for B. */
function winB(): SetScore[] {
  return [
    { a: 5, b: 11 },
    { a: 7, b: 11 },
  ];
}

describe("suggestedSwissRounds", () => {
  it("is at least 3", () => {
    expect(suggestedSwissRounds(4)).toBe(3);
  });
  it("scales with ceil(log2(N))", () => {
    expect(suggestedSwissRounds(16)).toBe(4);
    expect(suggestedSwissRounds(32)).toBe(5);
    expect(suggestedSwissRounds(64)).toBe(6);
  });
  it("returns 0 for < 2 players", () => {
    expect(suggestedSwissRounds(1)).toBe(0);
  });
});

describe("planSwissRound - round 0", () => {
  it("pairs top half vs bottom half by seed", () => {
    const { round, matches, byePlayerId } = planSwissRound({
      players: seeded(8),
    });
    expect(round).toBe(0);
    expect(byePlayerId).toBe(null);
    expect(matches).toHaveLength(4);
    // 1v5, 2v6, 3v7, 4v8
    expect(matches.map((m) => [m.a, m.b])).toEqual([
      ["p1", "p5"],
      ["p2", "p6"],
      ["p3", "p7"],
      ["p4", "p8"],
    ]);
  });

  it("awards the bye to the lowest-seeded player in an odd field", () => {
    const plan = planSwissRound({ players: seeded(5) });
    expect(plan.byePlayerId).toBe("p5");
    // Remaining 4 pair 1v3, 2v4
    expect(plan.matches.map((m) => [m.a, m.b])).toEqual([
      ["p1", "p3"],
      ["p2", "p4"],
    ]);
  });

  it("produces stable ids `sw-r0-m{n}`", () => {
    const plan = planSwissRound({ players: seeded(4) });
    expect(plan.matches.map((m) => m.id)).toEqual(["sw-r0-m0", "sw-r0-m1"]);
  });

  it("works with no players", () => {
    const plan = planSwissRound({ players: [] });
    expect(plan.matches).toEqual([]);
    expect(plan.byePlayerId).toBe(null);
  });
});

describe("planSwissRound - later rounds", () => {
  it("pairs within score groups after round 0", () => {
    // 4 players: 1v3 and 2v4 in round 0. Assume seeds 1 & 2 win.
    const history: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p3", sets: winA() },
      { round: 0, a: "p2", b: "p4", sets: winA() },
    ];
    const plan = planSwissRound({ players: seeded(4), history });
    expect(plan.round).toBe(1);
    // Score group "1 win": p1 and p2. Score group "0 wins": p3 and p4.
    // No rematches (1 vs 3, 2 vs 4 already played).
    const pairs = plan.matches.map((m) => [m.a, m.b].sort());
    expect(pairs).toContainEqual(["p1", "p2"].sort());
    expect(pairs).toContainEqual(["p3", "p4"].sort());
  });

  it("avoids rematches when possible", () => {
    // Round 0 result: 1v5, 2v6, 3v7, 4v8 - seeds win.
    const r0: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p5", sets: winA() },
      { round: 0, a: "p2", b: "p6", sets: winA() },
      { round: 0, a: "p3", b: "p7", sets: winA() },
      { round: 0, a: "p4", b: "p8", sets: winA() },
    ];
    const plan = planSwissRound({ players: seeded(8), history: r0 });
    // Top score group: p1..p4, all with 1 win. Pair top-half vs bottom-half by
    // seed within the group: 1v3, 2v4.
    const top = plan.matches.filter(
      (m) => ["p1", "p2", "p3", "p4"].includes(m.a) && m.b,
    );
    for (const m of top) {
      // No rematches possible in this small scenario; verify anyway.
      const alreadyPlayed = r0.some(
        (h) =>
          (h.a === m.a && h.b === m.b) || (h.a === m.b && h.b === m.a),
      );
      expect(alreadyPlayed).toBe(false);
    }
  });

  it("never pairs a player against themselves", () => {
    const history: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p4", sets: winA() },
      { round: 0, a: "p2", b: "p5", sets: winA() },
      { round: 0, a: "p3", b: "p6", sets: winB() },
    ];
    const plan = planSwissRound({ players: seeded(6), history });
    for (const m of plan.matches) {
      expect(m.a).not.toBe(m.b);
    }
  });

  it("assigns each active player exactly once per round", () => {
    const history: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p4", sets: winA() },
      { round: 0, a: "p2", b: "p5", sets: winB() },
      { round: 0, a: "p3", b: "p6", sets: winA() },
    ];
    const plan = planSwissRound({ players: seeded(6), history });
    const ids = plan.matches.flatMap((m) => [m.a, m.b].filter(Boolean));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not repeat byes to the same player if possible", () => {
    // 5 players, round 0: p5 has the bye.
    const history: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p3", sets: winA() },
      { round: 0, a: "p2", b: "p4", sets: winA() },
      { round: 0, a: "p5", b: null, sets: [] },
    ];
    const plan = planSwissRound({ players: seeded(5), history });
    expect(plan.byePlayerId).not.toBe("p5");
  });

  it("computes the correct next round number", () => {
    const history: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p2", sets: winA() },
      { round: 1, a: "p1", b: "p3", sets: winA() },
    ];
    const plan = planSwissRound({ players: seeded(4), history });
    expect(plan.round).toBe(2);
  });
});

describe("computeSwissStandings", () => {
  it("ranks by score desc", () => {
    const history: SwissHistoryMatch[] = [
      // Round 0: 1v5, 2v6, 3v7, 4v8
      { round: 0, a: "p1", b: "p5", sets: winA() },
      { round: 0, a: "p2", b: "p6", sets: winA() },
      { round: 0, a: "p3", b: "p7", sets: winA() },
      { round: 0, a: "p4", b: "p8", sets: winA() },
      // Round 1: winners bracket 1v2, 3v4; losers 5v6, 7v8
      { round: 1, a: "p1", b: "p2", sets: winA() },
      { round: 1, a: "p3", b: "p4", sets: winA() },
      { round: 1, a: "p5", b: "p6", sets: winA() },
      { round: 1, a: "p7", b: "p8", sets: winA() },
    ];
    const s = computeSwissStandings(seeded(8), history);
    expect(s.rows[0]!.playerId).toBe("p1"); // 2-0
    expect(s.rows[0]!.wins).toBe(2);
    expect(s.rows[0]!.rank).toBe(1);
    // p3 also has 2 wins - Buchholz breaks tie.
    expect(s.rows[1]!.playerId).toBe("p3");
    // Losers at 0-2: p6 and p8. p5 (1 win), p7 (1 win) ahead.
    expect(s.rows.map((r) => r.playerId).slice(-2).sort()).toEqual([
      "p6",
      "p8",
    ]);
  });

  it("uses seed as final tiebreaker", () => {
    const history: SwissHistoryMatch[] = [];
    const s = computeSwissStandings(seeded(4), history);
    // No matches, all 0 wins - seed wins.
    expect(s.rows.map((r) => r.playerId)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("counts byes as score increments with 0 sets won/lost", () => {
    const history: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p2", sets: winA() },
      { round: 0, a: "p3", b: null, sets: [] },
    ];
    const s = computeSwissStandings(seeded(3), history);
    const byRow = new Map(s.rows.map((r) => [r.playerId, r]));
    expect(byRow.get("p1")!.score).toBe(1);
    expect(byRow.get("p3")!.byes).toBe(1);
    expect(byRow.get("p3")!.score).toBe(1);
    expect(byRow.get("p3")!.setsWon).toBe(0);
  });

  it("is `complete:true` when all matches are finished", () => {
    const h: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p2", sets: winA() },
      { round: 0, a: "p3", b: "p4", sets: winA() },
    ];
    expect(computeSwissStandings(seeded(4), h).complete).toBe(true);
  });

  it("is `complete:false` with an incomplete match", () => {
    const h: SwissHistoryMatch[] = [
      { round: 0, a: "p1", b: "p2", sets: [{ a: 11, b: 5 }] },
    ];
    expect(computeSwissStandings(seeded(2), h).complete).toBe(false);
  });
});
