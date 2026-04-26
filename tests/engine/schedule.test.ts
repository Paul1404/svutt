import { describe, expect, it } from "vitest";
import {
  scheduleMatches,
  scheduleMatchesWithRest,
  type SchedulableMatch,
} from "@/lib/engine/schedule";

describe("scheduleMatches", () => {
  it("assigns matches to tables round-robin and increments play order", () => {
    const ids = ["m1", "m2", "m3", "m4", "m5", "m6"];
    const out = scheduleMatches(ids, {
      parallelTables: 3,
      matchDurationMinutes: 11,
    });
    expect(out.map((o) => o.tableNumber)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(out.map((o) => o.playOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out.map((o) => o.matchId)).toEqual(ids);
  });

  it("wraps table numbers correctly for more matches than tables", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const out = scheduleMatches(ids, {
      parallelTables: 2,
      matchDurationMinutes: 10,
    });
    expect(out.map((o) => o.tableNumber)).toEqual([1, 2, 1, 2, 1]);
  });

  it("clamps parallelTables to at least 1", () => {
    const out = scheduleMatches(["x", "y"], {
      parallelTables: 0,
      matchDurationMinutes: 5,
    });
    expect(out.map((o) => o.tableNumber)).toEqual([1, 1]);
  });
});

describe("scheduleMatchesWithRest", () => {
  function consecutivePairsForPlayer(
    out: ReturnType<typeof scheduleMatchesWithRest>,
    matches: readonly SchedulableMatch[],
    parallelTables: number,
  ) {
    const byId = new Map(matches.map((m) => [m.id, m]));
    const slots: Set<string>[] = [];
    for (const s of out) {
      const slotIdx = Math.floor(s.playOrder / parallelTables);
      const set = slots[slotIdx] ?? new Set<string>();
      const m = byId.get(s.matchId)!;
      if (m.a) set.add(m.a);
      if (m.b) set.add(m.b);
      slots[slotIdx] = set;
    }
    let bad = 0;
    for (let i = 1; i < slots.length; i++) {
      const prev = slots[i - 1]!;
      for (const p of slots[i]!) if (prev.has(p)) bad++;
    }
    return bad;
  }

  it("keeps every match exactly once with valid play order and table numbers", () => {
    const matches: SchedulableMatch[] = [
      { id: "m1", a: "p1", b: "p2" },
      { id: "m2", a: "p3", b: "p4" },
      { id: "m3", a: "p1", b: "p3" },
      { id: "m4", a: "p2", b: "p4" },
      { id: "m5", a: "p1", b: "p4" },
      { id: "m6", a: "p2", b: "p3" },
    ];
    const out = scheduleMatchesWithRest(matches, {
      parallelTables: 2,
      matchDurationMinutes: 11,
    });
    expect(out).toHaveLength(matches.length);
    expect(new Set(out.map((o) => o.matchId))).toEqual(
      new Set(matches.map((m) => m.id)),
    );
    expect(out.map((o) => o.playOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const o of out) {
      expect(o.tableNumber).toBeGreaterThanOrEqual(1);
      expect(o.tableNumber).toBeLessThanOrEqual(2);
    }
  });

  it("does not put two matches sharing a player in the same slot", () => {
    const matches: SchedulableMatch[] = [
      { id: "m1", a: "p1", b: "p2" },
      { id: "m2", a: "p1", b: "p3" },
      { id: "m3", a: "p2", b: "p3" },
    ];
    const out = scheduleMatchesWithRest(matches, {
      parallelTables: 3,
      matchDurationMinutes: 11,
    });
    const byOrder = new Map(out.map((o) => [o.matchId, o.playOrder]));
    expect(byOrder.get("m1")).not.toBe(byOrder.get("m2"));
    expect(byOrder.get("m1")).not.toBe(byOrder.get("m3"));
    expect(byOrder.get("m2")).not.toBe(byOrder.get("m3"));
  });

  it("avoids back-to-back slots for the same player when alternatives exist", () => {
    // Two independent groups of 4 players. Smart scheduler should let each
    // group rest while the other plays instead of running A through all its
    // rounds first.
    const groupA: SchedulableMatch[] = [
      { id: "a1", a: "A1", b: "A4" },
      { id: "a2", a: "A2", b: "A3" },
      { id: "a3", a: "A1", b: "A3" },
      { id: "a4", a: "A2", b: "A4" },
      { id: "a5", a: "A1", b: "A2" },
      { id: "a6", a: "A3", b: "A4" },
    ];
    const groupB: SchedulableMatch[] = [
      { id: "b1", a: "B1", b: "B4" },
      { id: "b2", a: "B2", b: "B3" },
      { id: "b3", a: "B1", b: "B3" },
      { id: "b4", a: "B2", b: "B4" },
      { id: "b5", a: "B1", b: "B2" },
      { id: "b6", a: "B3", b: "B4" },
    ];
    const all = [...groupA, ...groupB];
    const out = scheduleMatchesWithRest(all, {
      parallelTables: 2,
      matchDurationMinutes: 11,
    });
    // With one match per slot per group, no player should ever play two
    // slots in a row.
    expect(consecutivePairsForPlayer(out, all, 2)).toBe(0);
  });

  it("falls back to back-to-back play when no alternative is left", () => {
    // Single group of 4 players, 1 table: every slot has the same pool of
    // players so back-to-back play is unavoidable. The scheduler must still
    // emit every match exactly once.
    const matches: SchedulableMatch[] = [
      { id: "m1", a: "p1", b: "p2" },
      { id: "m2", a: "p3", b: "p4" },
      { id: "m3", a: "p1", b: "p3" },
      { id: "m4", a: "p2", b: "p4" },
      { id: "m5", a: "p1", b: "p4" },
      { id: "m6", a: "p2", b: "p3" },
    ];
    const out = scheduleMatchesWithRest(matches, {
      parallelTables: 1,
      matchDurationMinutes: 11,
    });
    expect(out).toHaveLength(matches.length);
  });

  it("tolerates null sides (KO / bye placeholders)", () => {
    const matches: SchedulableMatch[] = [
      { id: "m1", a: "p1", b: null },
      { id: "m2", a: null, b: "p2" },
    ];
    const out = scheduleMatchesWithRest(matches, {
      parallelTables: 2,
      matchDurationMinutes: 11,
    });
    expect(out).toHaveLength(2);
  });
});
