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
          sets: [{ a: 11, b: 3 }], // only 1 set - not complete
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

  it("breaks 3-way ties using head-to-head sub-table (ITTF-style)", () => {
    // Re-creates the Group B scenario where three players are tied at 2-2
    // but their head-to-head sub-table cleanly separates them, even though
    // overall set/point differential would order them differently.
    const [bahr, mayer, seufert, schmitt, koehler] = [
      player("bahr"),
      player("mayer"),
      player("seufert"),
      player("schmitt"),
      player("koehler"),
    ];
    const g = group(
      [bahr, mayer, seufert, schmitt, koehler],
      [
        // Schmitt beats Koehler 2:1 (11:4, 3:11, 11:0)
        {
          id: "m1",
          a: "schmitt",
          b: "koehler",
          sets: [
            { a: 11, b: 4 },
            { a: 3, b: 11 },
            { a: 11, b: 0 },
          ],
        },
        // Mayer beats Bahr 2:0 (11:1, 11:9)
        {
          id: "m2",
          a: "bahr",
          b: "mayer",
          sets: [
            { a: 1, b: 11 },
            { a: 9, b: 11 },
          ],
        },
        // Koehler beats Seufert 2:1 (11:9, 8:11, 6:11) — wait, scores in screenshot: 9:11, 11:8, 11:6
        {
          id: "m3",
          a: "koehler",
          b: "seufert",
          sets: [
            { a: 9, b: 11 },
            { a: 11, b: 8 },
            { a: 11, b: 6 },
          ],
        },
        // Bahr beats Schmitt 2:1 (6:11, 11:8, 11:5)
        {
          id: "m4",
          a: "schmitt",
          b: "bahr",
          sets: [
            { a: 11, b: 6 },
            { a: 8, b: 11 },
            { a: 5, b: 11 },
          ],
        },
        // Seufert beats Mayer 2:1 (11:8, 0:11, 11:9)
        {
          id: "m5",
          a: "seufert",
          b: "mayer",
          sets: [
            { a: 11, b: 8 },
            { a: 0, b: 11 },
            { a: 11, b: 9 },
          ],
        },
        // Bahr beats Koehler 2:0 (11:5, 11:8)
        {
          id: "m6",
          a: "koehler",
          b: "bahr",
          sets: [
            { a: 5, b: 11 },
            { a: 8, b: 11 },
          ],
        },
        // Bahr beats Seufert 2:0 (11:3, 11:3)
        {
          id: "m7",
          a: "bahr",
          b: "seufert",
          sets: [
            { a: 11, b: 3 },
            { a: 11, b: 3 },
          ],
        },
        // Schmitt beats Mayer 2:1 (7:11, 11:6, 11:5)
        {
          id: "m8",
          a: "mayer",
          b: "schmitt",
          sets: [
            { a: 11, b: 7 },
            { a: 6, b: 11 },
            { a: 5, b: 11 },
          ],
        },
        // Seufert beats Schmitt 2:0 (11:3, 11:0)
        {
          id: "m9",
          a: "seufert",
          b: "schmitt",
          sets: [
            { a: 11, b: 3 },
            { a: 11, b: 0 },
          ],
        },
        // Mayer beats Koehler 2:0 (11:3, 11:0)
        {
          id: "m10",
          a: "mayer",
          b: "koehler",
          sets: [
            { a: 11, b: 3 },
            { a: 11, b: 0 },
          ],
        },
      ],
    );
    const s = computeStandings(g);
    // Bahr clear winner with 3 wins.
    expect(s.rows[0]!.playerId).toBe("bahr");
    expect(s.rows[0]!.wins).toBe(3);
    // Among the three 2-win players: Seufert beat both other tied players,
    // Schmitt beat Mayer, Mayer lost both. Sub-table H2H must apply even
    // though overall setDiff (Mayer +2) would put Mayer first.
    expect(s.rows[1]!.playerId).toBe("seufert");
    expect(s.rows[2]!.playerId).toBe("schmitt");
    expect(s.rows[3]!.playerId).toBe("mayer");
    expect(s.rows[4]!.playerId).toBe("koehler");
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
