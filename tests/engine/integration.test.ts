import { describe, expect, it } from "vitest";
import {
  buildBracket,
  computeStandings,
  drawGroups,
  generateRoundRobin,
  scheduleMatches,
} from "@/lib/engine";
import type { EngineGroup, Player } from "@/lib/engine/types";

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Spieler ${i + 1}`,
  }));
}

describe("integration: full tournament pipeline", () => {
  it("draws, schedules, and computes winners end-to-end", () => {
    const pool = mockPlayers(10);
    const drawn = drawGroups(pool, { groupSize: 4, seed: "demo" });
    expect(drawn).toHaveLength(2);
    expect(drawn.every((g) => g.players.length === 5)).toBe(true);

    const allMatchIds: string[] = [];
    const groups: EngineGroup[] = drawn.map((dg) => {
      const plan = generateRoundRobin(dg.players);
      const matches = plan.map((p, i) => {
        const id = `${dg.label}-${i}`;
        allMatchIds.push(id);
        // Fake results: lower-index player always wins 2:0.
        const aIsLower =
          dg.players.findIndex((pp) => pp.id === p.a.id) <
          dg.players.findIndex((pp) => pp.id === p.b.id);
        return {
          id,
          a: p.a.id,
          b: p.b.id,
          sets: aIsLower
            ? [
                { a: 11, b: 3 },
                { a: 11, b: 5 },
              ]
            : [
                { a: 3, b: 11 },
                { a: 5, b: 11 },
              ],
        };
      });
      return {
        id: dg.label,
        label: dg.label,
        players: dg.players,
        matches,
      };
    });

    const scheduled = scheduleMatches(allMatchIds, {
      parallelTables: 3,
      matchDurationMinutes: 11,
    });
    expect(scheduled).toHaveLength(allMatchIds.length);
    expect(scheduled[0]!.tableNumber).toBe(1);

    // Top 1: just the 2 group winners → Finale.
    const bracket = buildBracket({ groups, advancementCount: 1 });
    expect(bracket.size).toBe(2);
    expect(bracket.matches).toHaveLength(1);
    expect(bracket.matches[0]!.label).toBe("Finale");

    // Each standings row must cover all 5 players in each group.
    for (const g of groups) {
      const s = computeStandings(g);
      expect(s.rows).toHaveLength(5);
      expect(s.rows[0]!.wins).toBe(4);
    }
  });
});
