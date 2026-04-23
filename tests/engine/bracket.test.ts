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
  it("Top 1 from 4 groups → 4-slot bracket with only winners", () => {
    const groups = ["A", "B", "C", "D"].map((lbl, gi) =>
      makeGroup(
        `g${gi}`,
        lbl,
        [0, 1, 2].map((pi) => makePlayer(`${lbl}${pi + 1}`)),
      ),
    );
    const br = buildBracket({ groups, advancementCount: 1 });
    expect(br.size).toBe(4);
    // First round: 2 matches, label "Halbfinale".
    const r0 = br.matches.filter((m) => m.round === 0);
    expect(r0).toHaveLength(2);
    expect(r0[0]!.label).toBe("Halbfinale");
    // With first-half vs second-half pairing: A1 vs C1, B1 vs D1.
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
    // Losers: rank 2 and 3 from every group → 8 players, own 8-slot bracket.
    expect(br.losers).not.toBeNull();
    expect(br.losersEntries).toHaveLength(8);
    expect(br.losers!.size).toBe(8);
  });

  it("default Top 2: 4 groups → 8-slot main bracket", () => {
    const groups = ["A", "B", "C", "D"].map((lbl, gi) =>
      makeGroup(
        `g${gi}`,
        lbl,
        [0, 1, 2, 3].map((pi) => makePlayer(`${lbl}${pi + 1}`)),
      ),
    );
    const br = buildBracket({ groups });
    // 4 groups × 2 qualifiers = 8 → Viertelfinale.
    expect(br.size).toBe(8);
    // Losers: ranks 3+4 from each group = 8 → own 8-slot bracket.
    expect(br.losersEntries).toHaveLength(8);
    expect(br.losers!.size).toBe(8);

    const r0 = br.matches.filter((m) => m.round === 0);
    expect(r0).toHaveLength(4);
    // Runners-up are seeded in reverse group order, so no same-group pairings
    // in round 1 are possible.
    for (const m of r0) {
      if (m.a.kind === "player" && m.b.kind === "player") {
        const aSrc = m.a.source;
        const bSrc = m.b.source;
        if ("groupLabel" in aSrc && "groupLabel" in bSrc) {
          expect(aSrc.groupLabel).not.toBe(bSrc.groupLabel);
        }
      }
    }
  });

  it("disabling lucky loser skips the secondary bracket", () => {
    const groups = ["A", "B", "C", "D"].map((lbl, gi) =>
      makeGroup(
        `g${gi}`,
        lbl,
        [0, 1, 2].map((pi) => makePlayer(`${lbl}${pi + 1}`)),
      ),
    );
    const br = buildBracket({
      groups,
      advancementCount: 1,
      luckyLoserEnabled: false,
    });
    expect(br.losers).toBeNull();
    expect(br.losersEntries).toHaveLength(0);
  });

  it("gives a bye (no first-round match) when a qualifier has no opponent", () => {
    // 3 groups of 2 → 3 winners advance. Main size = 4 → 1 would-be empty
    // slot. The paired winner should get a bye, not a ghost match against
    // nobody.
    const groups = [0, 1, 2].map((gi) => {
      const label = String.fromCharCode("A".charCodeAt(0) + gi);
      const players = [makePlayer(`${label}1`), makePlayer(`${label}2`)];
      return makeGroup(`g${gi}`, label, players);
    });
    const br = buildBracket({ groups, advancementCount: 1 });
    expect(br.size).toBe(4);

    // Every created match has both sides filled — no phantom "player vs …".
    for (const m of br.matches) {
      expect(m.a.kind).not.toBe("empty");
      expect(m.b.kind).not.toBe("empty");
    }

    // With 3 players in a 4-slot bracket, exactly one round-0 match is
    // played; the other two players meet the winner in the final. One of
    // the finalists comes via a bye (player slot), the other via pending.
    const r0 = br.matches.filter((m) => m.round === 0);
    expect(r0).toHaveLength(1);
    const final = br.matches.find((m) => m.label === "Finale")!;
    const hasByePlayer =
      final.a.kind === "player" || final.b.kind === "player";
    const hasPending =
      final.a.kind === "pending" || final.b.kind === "pending";
    expect(hasByePlayer).toBe(true);
    expect(hasPending).toBe(true);
  });

  it("skips whole-subtree byes without leaving empty matches", () => {
    // 10 players in a 16-slot bracket → 6 byes. Only fully-filled pairs
    // should produce round-0 matches.
    const groups = ["A", "B", "C", "D", "E"].map((lbl, gi) =>
      makeGroup(
        `g${gi}`,
        lbl,
        [0, 1, 2, 3].map((pi) => makePlayer(`${lbl}${pi + 1}`)),
      ),
    );
    const br = buildBracket({ groups, advancementCount: 2 });
    expect(br.size).toBe(16);

    for (const m of br.matches) {
      expect(m.a.kind).not.toBe("empty");
      expect(m.b.kind).not.toBe("empty");
    }

    // 10 seeded players → at most 5 real first-round matches (the bracket
    // first half has 5 filled + 3 empty, the second half has 5 filled + 3
    // empty; pairing first-half vs second-half yields some real matches and
    // some byes). The exact count depends on seeding interleave.
    const r0 = br.matches.filter((m) => m.round === 0);
    expect(r0.length).toBeLessThan(8);
  });

  it("handles a trivial 2-group tournament with Top 1", () => {
    const groups = ["A", "B"].map((lbl, gi) =>
      makeGroup(`g${gi}`, lbl, [makePlayer(`${lbl}1`), makePlayer(`${lbl}2`)]),
    );
    const br = buildBracket({ groups, advancementCount: 1 });
    expect(br.size).toBe(2);
    expect(br.matches).toHaveLength(1);
    expect(br.matches[0]!.label).toBe("Finale");
    // Losers: rank 2 from each group = 2 → Finale.
    expect(br.losers!.size).toBe(2);
  });

  it("produces 0-match bracket for no groups", () => {
    const br = buildBracket({ groups: [] });
    expect(br.size).toBe(0);
    expect(br.matches).toEqual([]);
    expect(br.losers).toBeNull();
  });
});
