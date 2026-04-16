import { describe, expect, it } from "vitest";
import { scheduleMatches } from "@/lib/engine/schedule";

describe("scheduleMatches", () => {
  it("assigns matches to tables round-robin and increments time per batch", () => {
    const ids = ["m1", "m2", "m3", "m4", "m5", "m6"];
    const out = scheduleMatches(ids, {
      startTime: "10:00",
      parallelTables: 3,
      matchDurationMinutes: 11,
    });
    expect(out.map((o) => o.tableNumber)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(out.map((o) => o.wallClock)).toEqual([
      "10:00",
      "10:00",
      "10:00",
      "10:11",
      "10:11",
      "10:11",
    ]);
  });

  it("uses the explicit formula: floor(i / tables) * duration", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const out = scheduleMatches(ids, {
      startTime: "09:30",
      parallelTables: 2,
      matchDurationMinutes: 10,
    });
    expect(out.map((o) => o.wallClock)).toEqual([
      "09:30",
      "09:30",
      "09:40",
      "09:40",
      "09:50",
    ]);
  });

  it("gracefully clamps invalid start times", () => {
    const out = scheduleMatches(["x"], {
      startTime: "not-a-time",
      parallelTables: 1,
      matchDurationMinutes: 5,
    });
    expect(out[0]!.wallClock).toBe("10:00");
  });

  it("wraps past midnight if the schedule gets long", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `m${i}`);
    const out = scheduleMatches(ids, {
      startTime: "23:00",
      parallelTables: 1,
      matchDurationMinutes: 30,
    });
    expect(out[2]!.wallClock).toBe("00:00"); // 23:00 + 60 min = 24:00 → wraps
  });
});
