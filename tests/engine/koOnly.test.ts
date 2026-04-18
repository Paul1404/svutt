import { describe, expect, it } from "vitest";
import { buildKoOnly, byeWinner, seedingOrder } from "@/lib/engine/koOnly";
import type { SeededPlayer } from "@/lib/engine/draw";

function seeded(count: number): SeededPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    seed: i + 1,
  }));
}

describe("seedingOrder", () => {
  it("returns [0] for size 1", () => {
    expect(seedingOrder(1)).toEqual([0]);
  });

  it("returns [0, 1] for size 2", () => {
    expect(seedingOrder(2)).toEqual([0, 1]);
  });

  it("places seeds 1-vs-4 / 2-vs-3 pattern for size 4", () => {
    // Seeds (0-based): expect 1 vs 4 then 2 vs 3 → [0, 3, 1, 2]
    expect(seedingOrder(4)).toEqual([0, 3, 1, 2]);
  });

  it("produces the classic 8-seed pattern", () => {
    expect(seedingOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
  });

  it("ensures top two seeds only meet in the final", () => {
    for (const size of [4, 8, 16, 32]) {
      const order = seedingOrder(size);
      const idxOfSeed1 = order.indexOf(0);
      const idxOfSeed2 = order.indexOf(1);
      // Seed 1 is in the top half, seed 2 in the bottom half.
      expect(idxOfSeed1 < size / 2).toBe(true);
      expect(idxOfSeed2 >= size / 2).toBe(true);
    }
  });
});

describe("buildKoOnly", () => {
  it("returns an empty bracket for fewer than 2 players", () => {
    const b = buildKoOnly({ players: seeded(1) });
    expect(b.size).toBe(0);
    expect(b.matches).toEqual([]);
  });

  it("builds a size-4 bracket for 4 seeded players", () => {
    const b = buildKoOnly({ players: seeded(4) });
    expect(b.size).toBe(4);
    expect(b.matches).toHaveLength(3); // 2 SF + 1 final
    const round0 = b.matches.filter((m) => m.round === 0);
    expect(round0).toHaveLength(2);

    // First match: seed 1 vs seed 4
    const first = round0[0]!;
    expect(first.a.kind).toBe("player");
    expect(first.b.kind).toBe("player");
    if (first.a.kind === "player") expect(first.a.playerId).toBe("p1");
    if (first.b.kind === "player") expect(first.b.playerId).toBe("p4");
    // Second: seed 2 vs seed 3
    const second = round0[1]!;
    if (second.a.kind === "player") expect(second.a.playerId).toBe("p2");
    if (second.b.kind === "player") expect(second.b.playerId).toBe("p3");
  });

  it("labels the last round 'Finale'", () => {
    const b = buildKoOnly({ players: seeded(4) });
    const final = b.matches.find((m) => m.round === 1);
    expect(final?.label).toBe("Finale");
  });

  it("grows to the next power of two with byes for the top seed", () => {
    const b = buildKoOnly({ players: seeded(5) });
    expect(b.size).toBe(8);
    const round0 = b.matches.filter((m) => m.round === 0);
    expect(round0).toHaveLength(4);
    // Seed 1 is at slot 0 (byeing slot 7). Slot 7 is empty.
    const firstMatch = round0[0]!;
    expect(firstMatch.a.kind).toBe("player");
    if (firstMatch.a.kind === "player") {
      expect(firstMatch.a.playerId).toBe("p1");
    }
    expect(firstMatch.b.kind).toBe("empty");
  });

  it("identifies the bye winner of a first-round match", () => {
    const m = {
      a: {
        kind: "player" as const,
        playerId: "p1",
        source: { type: "winner" as const, groupLabel: "Setzliste 1" },
      },
      b: { kind: "empty" as const },
    };
    expect(byeWinner(m)).toBe("A");
    const m2 = {
      a: { kind: "empty" as const },
      b: {
        kind: "player" as const,
        playerId: "p2",
        source: { type: "winner" as const, groupLabel: "Setzliste 2" },
      },
    };
    expect(byeWinner(m2)).toBe("B");
  });

  it("returns null bye-winner when both sides have players", () => {
    const m = {
      a: {
        kind: "player" as const,
        playerId: "p1",
        source: { type: "winner" as const, groupLabel: "Setzliste 1" },
      },
      b: {
        kind: "player" as const,
        playerId: "p2",
        source: { type: "winner" as const, groupLabel: "Setzliste 2" },
      },
    };
    expect(byeWinner(m)).toBe(null);
  });

  it("handles mixed seeded + unseeded players deterministically", () => {
    const mixed: SeededPlayer[] = [
      { id: "s1", name: "S1", seed: 1 },
      { id: "s2", name: "S2", seed: 2 },
      { id: "u1", name: "U1" },
      { id: "u2", name: "U2" },
    ];
    const a = buildKoOnly({ players: mixed, seed: "fixed" });
    const b = buildKoOnly({ players: mixed, seed: "fixed" });
    expect(a.matches.length).toBe(b.matches.length);
    // Same positions
    for (let i = 0; i < a.matches.length; i++) {
      expect(JSON.stringify(a.matches[i])).toBe(JSON.stringify(b.matches[i]));
    }
  });

  it("pending slots in later rounds reference earlier match ids", () => {
    const b = buildKoOnly({ players: seeded(8) });
    const semi = b.matches.find((m) => m.round === 1 && m.matchIndex === 0)!;
    expect(semi.a.kind).toBe("pending");
    expect(semi.b.kind).toBe("pending");
  });

  it("assigns every round 0 slot exactly once", () => {
    const b = buildKoOnly({ players: seeded(8) });
    const round0 = b.matches.filter((m) => m.round === 0);
    const playerIds = new Set<string>();
    for (const m of round0) {
      if (m.a.kind === "player") playerIds.add(m.a.playerId);
      if (m.b.kind === "player") playerIds.add(m.b.playerId);
    }
    expect(playerIds.size).toBe(8);
  });
});
