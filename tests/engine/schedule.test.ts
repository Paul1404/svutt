import { describe, expect, it } from "vitest";
import { scheduleMatches } from "@/lib/engine/schedule";

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
