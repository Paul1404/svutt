import { describe, expect, it } from "vitest";
import { computeStandings, isGroupComplete } from "@/lib/engine/standings";
import type { EngineGroup, Player } from "@/lib/engine/types";

function player(id: string): Player {
  return { id, name: id };
}

function group(players: Player[], matches: EngineGroup["matches"]): EngineGroup {
  return { id: "g1", label: "A", players, matches };
}

describe("computeStandings", () => {
  it("ranks a clean 3-player group by wins", () => {
    const [p1, p2, p3] = [player("p1"), player("p2"), player("p3")];
    const g = group(
      [p1, p2, p3],
      [
        {
          id: "m1",
          a: "p1",
          b: "p2",
          sets: [
            { a: 11, b: 3 },
            { a: 11, b: 5 },
          ],
        },
        {
          id: "m2",
          a: "p1",
          b: "p3",
          sets: [
            { a: 11, b: 8 },
            { a: 11, b: 6 },
          ],
        },
        {
          id: "m3",
          a: "p2",
          b: "p3",
          sets: [
            { a: 11, b: 9 },
            { a: 11, b: 7 },
          ],
        },
      ],
    );
    const s = computeStandings(g);
    expect(s.rows[0]!.playerId).toBe("p1");
    expect(s.rows[0]!.wins).toBe(2);
    expect(s.rows[1]!.playerId).toBe("p2");
    expect(s.rows[2]!.playerId).toBe("p3");
  });

  it("breaks ties by set diff when wins equal", () => {
    const [p1, p2, p3] = [player("p1"), player("p2"), player("p3")];
    const g = group(
      [p1, p2, p3],
      [
        // p1 beats p2 2:0
        {
          id: "m1",
          a: "p1",
          b: "p2",
          sets: [
            { a: 11, b: 5 },
            { a: 11, b: 5 },
          ],
        },
        // p2 beats p3 2:1
        {
          id: "m2",
          a: "p2",
          b: "p3",
          sets: [
            { a: 11, b: 6 },
            { a: 5, b: 11 },
            { a: 11, b: 7 },
          ],
        },
        // p3 beats p1 2:1
        {
          id: "m3",
          a: "p3",
          b: "p1",
          sets: [
            { a: 11, b: 5 },
            { a: 3, b: 11 },
            { a: 11, b: 8 },
          ],
        },
      ],
    );
    const s = computeStandings(g);
    // All three tied at 1-1 record
    for (const row of s.rows) expect(row.wins).toBe(1);
    // p1 has setsWon=3 setsLost=2 → +1
    // p2 has setsWon=3 setsLost=3 → 0
    // p3 has setsWon=3 setsLost=3 → 0 (but has won against p1, head-to-head)
    // So top by set diff must be p1.
    expect(s.rows[0]!.playerId).toBe("p1");
  });

  it("ignores incomplete matches", () => {
    const [p1, p2] = [player("p1"), player("p2")];
    const g = group(
      [p1, p2],
      [
        {
          id: "m",
          a: "p1",
          b: "p2",
          sets: [{ a: 11, b: 3 }], // only 1 set — not complete
        },
      ],
    );
    const s = computeStandings(g);
    expect(s.rows[0]!.matchesPlayed).toBe(0);
    expect(s.rows[1]!.matchesPlayed).toBe(0);
  });

  it("marks tied rows", () => {
    const [p1, p2] = [player("p1"), player("p2")];
    const g = group([p1, p2], []);
    const s = computeStandings(g);
    expect(s.rows.every((r) => r.tied)).toBe(true);
  });

  it("ranks are 1-based and contiguous", () => {
    const [p1, p2, p3] = [player("p1"), player("p2"), player("p3")];
    const g = group([p1, p2, p3], []);
    const s = computeStandings(g);
    expect(s.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe("isGroupComplete", () => {
  it("returns false when matches remain", () => {
    const [p1, p2, p3] = [player("p1"), player("p2"), player("p3")];
    expect(
      isGroupComplete({
        players: [p1, p2, p3],
        matches: [
          {
            id: "m",
            a: "p1",
            b: "p2",
            sets: [
              { a: 11, b: 0 },
              { a: 11, b: 0 },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it("returns true when all round-robin matches are complete", () => {
    const [p1, p2] = [player("p1"), player("p2")];
    expect(
      isGroupComplete({
        players: [p1, p2],
        matches: [
          {
            id: "m",
            a: "p1",
            b: "p2",
            sets: [
              { a: 11, b: 0 },
              { a: 11, b: 0 },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
