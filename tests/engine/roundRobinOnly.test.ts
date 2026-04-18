import { describe, expect, it } from "vitest";
import {
  planRoundRobinOnly,
  roundRobinStandings,
} from "@/lib/engine/roundRobinOnly";
import type { SeededPlayer } from "@/lib/engine/draw";
import type { EngineGroup, EngineMatch } from "@/lib/engine/types";

function players(n: number): SeededPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

describe("planRoundRobinOnly", () => {
  it("puts every player in the single pseudo-group 'A'", () => {
    const plan = planRoundRobinOnly({ players: players(5) });
    expect(plan.group.label).toBe("A");
    expect(plan.group.position).toBe(0);
    expect(plan.group.players).toHaveLength(5);
  });

  it("generates C(N,2) matches for N players", () => {
    const plan = planRoundRobinOnly({ players: players(6) });
    expect(plan.matches).toHaveLength((6 * 5) / 2);
  });

  it("no player plays twice per round", () => {
    const plan = planRoundRobinOnly({ players: players(8) });
    const byRound = new Map<number, string[]>();
    for (const m of plan.matches) {
      const arr = byRound.get(m.round) ?? [];
      arr.push(m.a.id, m.b.id);
      byRound.set(m.round, arr);
    }
    for (const [, ids] of byRound) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("orders by participant.seed when drawMode is seeded_snake", () => {
    const pool: SeededPlayer[] = [
      { id: "a", name: "A", seed: 4 },
      { id: "b", name: "B", seed: 1 },
      { id: "c", name: "C", seed: 3 },
      { id: "d", name: "D", seed: 2 },
    ];
    const plan = planRoundRobinOnly({
      players: pool,
      drawMode: "seeded_snake",
    });
    expect(plan.group.players.map((p) => p.id)).toEqual(["b", "d", "c", "a"]);
  });

  it("keeps insertion order otherwise", () => {
    const plan = planRoundRobinOnly({ players: players(4) });
    expect(plan.group.players.map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
  });

  it("produces zero matches for a single player", () => {
    const plan = planRoundRobinOnly({ players: players(1) });
    expect(plan.matches).toEqual([]);
  });
});

describe("roundRobinStandings", () => {
  it("ranks the winner at the top after a complete round-robin", () => {
    const pool = players(3);
    const group: Pick<EngineGroup, "id" | "label" | "players" | "matches"> = {
      id: "g",
      label: "A",
      players: pool,
      matches: [
        match("m1", "p1", "p2", [
          { a: 11, b: 5 },
          { a: 11, b: 7 },
        ]),
        match("m2", "p1", "p3", [
          { a: 11, b: 3 },
          { a: 11, b: 9 },
        ]),
        match("m3", "p2", "p3", [
          { a: 11, b: 6 },
          { a: 11, b: 8 },
        ]),
      ],
    };
    const s = roundRobinStandings(group);
    expect(s.rows[0]?.playerId).toBe("p1");
    expect(s.rows[0]?.wins).toBe(2);
    expect(s.rows[1]?.playerId).toBe("p2");
    expect(s.rows[2]?.playerId).toBe("p3");
  });

  it("returns zeroed rows when nothing has been played", () => {
    const group: Pick<EngineGroup, "id" | "label" | "players" | "matches"> = {
      id: "g",
      label: "A",
      players: players(4),
      matches: [],
    };
    const s = roundRobinStandings(group);
    expect(s.rows).toHaveLength(4);
    expect(s.rows.every((r) => r.matchesPlayed === 0)).toBe(true);
  });
});

function match(
  id: string,
  a: string,
  b: string,
  sets: { a: number; b: number }[],
): EngineMatch {
  return { id, a, b, sets };
}
