import { describe, expect, it } from "vitest";
import {
  computePreview,
  formatDuration,
  suggestGroupSize,
} from "@/lib/preview";

describe("computePreview", () => {
  it("handles too-few participants gracefully", () => {
    const p = computePreview({
      participantCount: 1,
      groupSize: 4,
      luckyLoserEnabled: true,
    });
    expect(p.groupCount).toBe(0);
    expect(p.totalMatches).toBe(0);
    expect(p.summary).toMatch(/Zu wenige/);
  });

  it("4 players, groupSize 4: single group, no KO", () => {
    const p = computePreview({
      participantCount: 4,
      groupSize: 4,
      luckyLoserEnabled: true,
    });
    expect(p.groupCount).toBe(1);
    expect(p.hasKO).toBe(false);
    expect(p.groupMatches).toBe(6);
    expect(p.totalMatches).toBe(6);
  });

  it("8 players in 2 groups of 4 → Finale (size 2)", () => {
    const p = computePreview({
      participantCount: 8,
      groupSize: 4,
      luckyLoserEnabled: true,
    });
    expect(p.groupCount).toBe(2);
    expect(p.koSize).toBe(2);
    expect(p.koMatches).toBe(1);
    expect(p.luckyLoserSlots).toBe(0);
    expect(p.summary).toContain("Finale");
  });

  it("12 players at groupSize 4: 3 groups → Halbfinale with 1 Lucky Loser", () => {
    const p = computePreview({
      participantCount: 12,
      groupSize: 4,
      luckyLoserEnabled: true,
    });
    expect(p.groupCount).toBe(3);
    expect(p.koSize).toBe(4);
    expect(p.luckyLoserSlots).toBe(1);
    expect(p.summary).toContain("Halbfinale");
    expect(p.summary).toContain("Lucky Loser");
  });

  it("with luckyLoserEnabled=false, summary mentions Freilos", () => {
    const p = computePreview({
      participantCount: 12,
      groupSize: 4,
      luckyLoserEnabled: false,
    });
    expect(p.luckyLoserSlots).toBe(0);
    expect(p.summary).toContain("Freilos");
  });

  it("estimated duration scales with parallel tables", () => {
    const a = computePreview({
      participantCount: 16,
      groupSize: 4,
      luckyLoserEnabled: true,
      matchDurationMinutes: 10,
      parallelTables: 1,
    });
    const b = computePreview({
      participantCount: 16,
      groupSize: 4,
      luckyLoserEnabled: true,
      matchDurationMinutes: 10,
      parallelTables: 4,
    });
    expect(a.estimatedMinutes).toBeGreaterThan(b.estimatedMinutes);
    expect(b.estimatedMinutes).toBe(Math.ceil(a.estimatedMinutes / 4));
  });
});

describe("formatDuration", () => {
  it("formats short, medium, and long durations", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(30)).toBe("ca. 30 Min");
    expect(formatDuration(60)).toBe("ca. 1 h");
    expect(formatDuration(90)).toBe("ca. 1 h 30 Min");
  });
});

describe("suggestGroupSize", () => {
  it("returns a valid size for typical participant counts", () => {
    for (const n of [4, 6, 8, 12, 16, 20, 24, 32]) {
      const size = suggestGroupSize(n);
      expect(size).toBeGreaterThanOrEqual(3);
      expect(size).toBeLessThanOrEqual(8);
    }
  });

  it("prefers 4 for power-of-two-friendly counts", () => {
    expect(suggestGroupSize(16)).toBe(4);
    expect(suggestGroupSize(32)).toBe(4);
  });

  it("handles tiny counts without crashing", () => {
    expect(suggestGroupSize(2)).toBeGreaterThanOrEqual(2);
    expect(suggestGroupSize(3)).toBeGreaterThanOrEqual(2);
  });
});
