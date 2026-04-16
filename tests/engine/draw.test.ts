import { describe, expect, it } from "vitest";
import { computeGroupShape, drawGroups, groupLabel } from "@/lib/engine/draw";
import type { Player } from "@/lib/engine/types";

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
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

describe("groupLabel", () => {
  it("returns single-letter labels for first 16 groups", () => {
    expect(groupLabel(0)).toBe("A");
    expect(groupLabel(15)).toBe("P");
  });
  it("returns double-letter labels beyond 16", () => {
    expect(groupLabel(16)).toBe("AA");
  });
});
