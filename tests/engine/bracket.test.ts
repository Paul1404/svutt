import { describe, expect, it } from "vitest";
import { buildBracket, nextPowerOfTwo } from "@/lib/engine/bracket";
import type { EngineGroup, Player } from "@/lib/engine/types";

function makePlayer(id: string): Player {
  return { id, name: id };
}

/**
 * Build a group where player[0] beats player[1] beats player[2] ...
 * All 2:0 results, so points lost is always 0 and points won varies.
 */
function makeGroup(id: string, label: string, players: Player[]): EngineGroup {
  const matches: EngineGroup["matches"] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({
        id: `${id}-${i}-${j}`,
        a: players[i]!.id,
        b: players[j]!.id,
        sets: [
          { a: 11, b: 3 + j },
          { a: 11, b: 3 + j },
        ],
      });
    }
  }
  return { id, label, players, matches };
}

describe("nextPowerOfTwo", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [7, 8],
    [8, 8],
    [9, 16],
  ])("nextPowerOfTwo(%i) = %i", (n, expected) => {
    expect(nextPowerOfTwo(n)).toBe(expected);
  });
});

describe("buildBracket", () => {
  it("builds a 4-slot bracket from 4 groups with no lucky losers", () => {
    const groups = ["A", "B", "C", "D"].map((lbl, gi) =>
      makeGroup(
        `g${gi}`,
        lbl,
        [0, 1, 2].map((pi) => makePlayer(`${lbl}${pi + 1}`)),
      ),
    );
    const br = buildBracket({ groups });
    expect(br.size).toBe(4);
    expect(br.luckyLosers).toHaveLength(0);
    // First round: 2 matches, label "Halbfinale".
    const r0 = br.matches.filter((m) => m.round === 0);
    expect(r0).toHaveLength(2);
    expect(r0[0]!.label).toBe("Halbfinale");
    // Pairing: A1 vs C1 (slots 0 & 2), B1 vs D1 (slots 1 & 3)
    expect(r0[0]!.a.kind).toBe("player");
    expect(r0[0]!.b.kind).toBe("player");
    if (r0[0]!.a.kind === "player" && r0[0]!.b.kind === "player") {
      expect(r0[0]!.a.playerId).toBe("A1");
      expect(r0[0]!.b.playerId).toBe("C1");
    }
    if (r0[1]!.a.kind === "player" && r0[1]!.b.kind === "player") {
      expect(r0[1]!.a.playerId).toBe("B1");
      expect(r0[1]!.b.playerId).toBe("D1");
    }
    // Final: pending from both semis
    const final = br.matches.find((m) => m.label === "Finale");
    expect(final).toBeDefined();
    expect(final!.a.kind).toBe("pending");
    expect(final!.b.kind).toBe("pending");
  });

  it("promotes one Lucky Loser when 7 groups", () => {
    // 7 groups of 3. Group A's third will win the most points -> should be LL.
    const groups = Array.from({ length: 7 }, (_, gi) => {
      const label = String.fromCharCode("A".charCodeAt(0) + gi);
      const players = [0, 1, 2].map((pi) => makePlayer(`${label}${pi + 1}`));
      // Make group A's 3rd place have a great set diff: give them close matches
      if (gi === 0) {
        return {
          id: `g${gi}`,
          label,
          players,
          matches: [
            // A1 beats A2 2:0
            {
              id: "m1",
              a: "A1",
              b: "A2",
              sets: [
                { a: 11, b: 9 },
                { a: 11, b: 9 },
              ],
            },
            // A1 beats A3 2:0
            {
              id: "m2",
              a: "A1",
              b: "A3",
              sets: [
                { a: 11, b: 9 },
                { a: 11, b: 9 },
              ],
            },
            // A2 beats A3 2:1 → A3 wins at least one set (good for set diff)
            {
              id: "m3",
              a: "A2",
              b: "A3",
              sets: [
                { a: 11, b: 6 },
                { a: 6, b: 11 },
                { a: 11, b: 9 },
              ],
            },
          ],
        } as EngineGroup;
      }
      return makeGroup(`g${gi}`, label, players);
    });
    const br = buildBracket({ groups });
    expect(br.size).toBe(8);
    expect(br.luckyLosers).toHaveLength(1);
    // Lucky loser should be the group A third place player (A3)
    expect(br.luckyLosers[0]!.playerId).toBe("A3");
    expect(br.luckyLosers[0]!.groupLabel).toBe("A");
    // Round 0 should have 4 matches and the lucky-loser is one of the slots
    const r0 = br.matches.filter((m) => m.round === 0);
    expect(r0).toHaveLength(4);
    const playerSlots = r0.flatMap((m) => [m.a, m.b]).filter((s) => s.kind === "player");
    const hasLL = playerSlots.some(
      (s) => s.kind === "player" && s.source.type === "luckyLoser",
    );
    expect(hasLL).toBe(true);
  });

  it("leaves slots empty when no lucky losers exist (e.g. 2-player groups)", () => {
    const groups = [0, 1, 2].map((gi) => {
      const label = String.fromCharCode("A".charCodeAt(0) + gi);
      const players = [makePlayer(`${label}1`), makePlayer(`${label}2`)];
      return makeGroup(`g${gi}`, label, players);
    });
    const br = buildBracket({ groups });
    expect(br.size).toBe(4);
    // 1 missing slot, but no third place players exist → empty slot.
    const r0 = br.matches.filter((m) => m.round === 0);
    expect(r0).toHaveLength(2);
    const empties = r0.flatMap((m) => [m.a, m.b]).filter((s) => s.kind === "empty");
    expect(empties.length).toBeGreaterThan(0);
  });

  it("handles a trivial 2-group tournament", () => {
    const groups = ["A", "B"].map((lbl, gi) =>
      makeGroup(`g${gi}`, lbl, [makePlayer(`${lbl}1`), makePlayer(`${lbl}2`)]),
    );
    const br = buildBracket({ groups });
    expect(br.size).toBe(2);
    expect(br.matches).toHaveLength(1);
    expect(br.matches[0]!.label).toBe("Finale");
  });

  it("produces 0-match bracket for no groups", () => {
    const br = buildBracket({ groups: [] });
    expect(br.size).toBe(0);
    expect(br.matches).toEqual([]);
  });
});
