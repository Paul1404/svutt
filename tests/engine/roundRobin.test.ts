import { describe, expect, it } from "vitest";
import { generateRoundRobin } from "@/lib/engine/roundRobin";
import type { Player } from "@/lib/engine/types";

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
  }));
}

describe("generateRoundRobin", () => {
  it("generates n*(n-1)/2 matches", () => {
    expect(generateRoundRobin(players(4))).toHaveLength(6);
    expect(generateRoundRobin(players(5))).toHaveLength(10);
    expect(generateRoundRobin(players(6))).toHaveLength(15);
    expect(generateRoundRobin(players(8))).toHaveLength(28);
  });

  it("pairs every player against every other exactly once", () => {
    const pool = players(5);
    const matches = generateRoundRobin(pool);
    const pairs = new Set<string>();
    for (const m of matches) {
      const key = [m.a.id, m.b.id].sort().join("|");
      pairs.add(key);
    }
    expect(pairs.size).toBe(matches.length);
    const expected = (pool.length * (pool.length - 1)) / 2;
    expect(pairs.size).toBe(expected);
  });

  it("no player plays twice in the same round", () => {
    const pool = players(6);
    const matches = generateRoundRobin(pool);
    const perRound = new Map<number, Set<string>>();
    for (const m of matches) {
      const set = perRound.get(m.round) ?? new Set();
      expect(set.has(m.a.id)).toBe(false);
      expect(set.has(m.b.id)).toBe(false);
      set.add(m.a.id);
      set.add(m.b.id);
      perRound.set(m.round, set);
    }
  });

  it("returns empty for < 2 players", () => {
    expect(generateRoundRobin(players(1))).toEqual([]);
    expect(generateRoundRobin([])).toEqual([]);
  });
});
