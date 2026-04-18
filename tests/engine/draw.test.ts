import { describe, expect, it } from "vitest";
import {
  computeGroupShape,
  drawGroups,
  groupLabel,
  orderBySeed,
  type SeededPlayer,
} from "@/lib/engine/draw";
import type { Player } from "@/lib/engine/types";

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function seededPlayers(
  entries: { id: string; seed?: number | null }[],
): SeededPlayer[] {
  return entries.map((e) => ({
    id: e.id,
    name: `Player ${e.id}`,
    seed: e.seed ?? null,
  }));
}

describe("computeGroupShape", () => {
  it("distributes 8 players into two groups of 4", () => {
    expect(computeGroupShape(8, 4)).toEqual([4, 4]);
  });

  it("uses 5+5 for 10 players at preferred size 4 (not 4+4+2)", () => {
    expect(computeGroupShape(10, 4)).toEqual([5, 5]);
  });

  it("uses 4+4+4 for 12 players at preferred 4", () => {
    expect(computeGroupShape(12, 4)).toEqual([4, 4, 4]);
  });

  it("uses 5+5+4 for 14 players at preferred 4", () => {
    expect(computeGroupShape(14, 4)).toEqual([5, 5, 4]);
  });

  it("uses 5+5+5 for 15 players at preferred 4", () => {
    expect(computeGroupShape(15, 4)).toEqual([5, 5, 5]);
  });

  it("splits oversized groups when single group would exceed +2 limit (7 @ 4 -> 4+3)", () => {
    expect(computeGroupShape(7, 4)).toEqual([4, 3]);
  });

  it("keeps single group when one group fits within tolerance (6 @ 4 -> 6)", () => {
    expect(computeGroupShape(6, 4)).toEqual([6]);
  });

  it("handles preferred size 8", () => {
    expect(computeGroupShape(16, 8)).toEqual([8, 8]);
    expect(computeGroupShape(20, 8)).toEqual([10, 10]);
  });

  it("handles empty pool", () => {
    expect(computeGroupShape(0, 4)).toEqual([]);
  });
});

describe("drawGroups", () => {
  it("assigns every player to exactly one group", () => {
    const pool = players(10);
    const groups = drawGroups(pool, { groupSize: 4, seed: "fixed" });
    const assigned = groups.flatMap((g) => g.players.map((p) => p.id));
    expect(assigned.sort()).toEqual(pool.map((p) => p.id).sort());
  });

  it("produces the expected group shape", () => {
    const groups = drawGroups(players(14), { groupSize: 4, seed: 1 });
    expect(groups.map((g) => g.players.length)).toEqual([5, 5, 4]);
  });

  it("is deterministic given the same seed", () => {
    const a = drawGroups(players(12), { groupSize: 4, seed: "x" });
    const b = drawGroups(players(12), { groupSize: 4, seed: "x" });
    expect(a.map((g) => g.players.map((p) => p.id))).toEqual(
      b.map((g) => g.players.map((p) => p.id)),
    );
  });

  it("labels groups A, B, C…", () => {
    const groups = drawGroups(players(12), { groupSize: 4 });
    expect(groups.map((g) => g.label)).toEqual(["A", "B", "C"]);
  });
});

describe("orderBySeed", () => {
  it("sorts seeded players by seed asc", () => {
    const sorted = orderBySeed(
      seededPlayers([
        { id: "a", seed: 3 },
        { id: "b", seed: 1 },
        { id: "c", seed: 2 },
      ]),
    );
    expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("places unseeded players last, preserving insertion order", () => {
    const sorted = orderBySeed(
      seededPlayers([
        { id: "x" },
        { id: "a", seed: 2 },
        { id: "y" },
        { id: "b", seed: 1 },
      ]),
    );
    expect(sorted.map((p) => p.id)).toEqual(["b", "a", "x", "y"]);
  });

  it("is stable for players with equal seeds", () => {
    const sorted = orderBySeed(
      seededPlayers([
        { id: "a", seed: 1 },
        { id: "b", seed: 1 },
        { id: "c", seed: 1 },
      ]),
    );
    expect(sorted.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("drawGroups — seeded_snake mode", () => {
  it("ignores the RNG seed and uses participant.seed order", () => {
    const pool: SeededPlayer[] = seededPlayers([
      { id: "p1", seed: 1 },
      { id: "p2", seed: 2 },
      { id: "p3", seed: 3 },
      { id: "p4", seed: 4 },
      { id: "p5", seed: 5 },
      { id: "p6", seed: 6 },
      { id: "p7", seed: 7 },
      { id: "p8", seed: 8 },
    ]);
    const a = drawGroups(pool, { groupSize: 4, drawMode: "seeded_snake" });
    const b = drawGroups(pool, {
      groupSize: 4,
      drawMode: "seeded_snake",
      seed: "different",
    });
    expect(a).toEqual(b);
  });

  it("distributes top seeds across different groups (snake)", () => {
    const pool = seededPlayers([
      { id: "s1", seed: 1 },
      { id: "s2", seed: 2 },
      { id: "s3", seed: 3 },
      { id: "s4", seed: 4 },
      { id: "s5", seed: 5 },
      { id: "s6", seed: 6 },
      { id: "s7", seed: 7 },
      { id: "s8", seed: 8 },
    ]);
    const groups = drawGroups(pool, { groupSize: 4, drawMode: "seeded_snake" });
    // Two groups. Snake: 0→A, 1→B, 2→B, 3→A, 4→A, 5→B, 6→B, 7→A.
    // Seed 1 and 2 must land in different groups.
    const groupOf = (id: string) =>
      groups.findIndex((g) => g.players.some((p) => p.id === id));
    expect(groupOf("s1")).not.toBe(groupOf("s2"));
    // Also top seeds of each group are 1 and 2.
    const topSeedsByGroup = groups.map(
      (g) => Math.min(...g.players.map((p) => (p.seed as number) ?? 99)),
    );
    expect(topSeedsByGroup.sort()).toEqual([1, 2]);
  });

  it("places unseeded players after seeded ones in snake order", () => {
    const pool = seededPlayers([
      { id: "s1", seed: 1 },
      { id: "s2", seed: 2 },
      { id: "u1" },
      { id: "u2" },
    ]);
    const groups = drawGroups(pool, { groupSize: 2, drawMode: "seeded_snake" });
    expect(groups).toHaveLength(2);
    // Snake over 2 groups for 4 players: 0→A, 1→B, 2→B, 3→A.
    // Ordered by seed: [s1, s2, u1, u2]. So A=[s1,u2], B=[s2,u1].
    expect(groups[0]!.players.map((p) => p.id)).toEqual(["s1", "u2"]);
    expect(groups[1]!.players.map((p) => p.id)).toEqual(["s2", "u1"]);
  });
});

describe("groupLabel", () => {
  it("returns single-letter labels for first 16 groups", () => {
    expect(groupLabel(0)).toBe("A");
    expect(groupLabel(15)).toBe("P");
  });
  it("returns double-letter labels beyond 16", () => {
    expect(groupLabel(16)).toBe("AA");
  });
});
