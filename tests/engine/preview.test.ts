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
    // Single group → only the group phase, no KO.
    expect(p.hasKO).toBe(false);
    expect(p.groupMatches).toBe(6);
    expect(p.totalMatches).toBe(6);
  });

  it("8 players in 2 groups of 4 → Halbfinale (size 4) with Top 2", () => {
    const p = computePreview({
      participantCount: 8,
      groupSize: 4,
      luckyLoserEnabled: true,
    });
    expect(p.groupCount).toBe(2);
    // Top 2 per group = 4 main qualifiers.
    expect(p.koSize).toBe(4);
    expect(p.koMatches).toBe(3);
    // Losers: rank 3 + rank 4 from each group = 4 → losers bracket size 4.
    expect(p.losersPoolSize).toBe(4);
    expect(p.losersKoSize).toBe(4);
    expect(p.summary).toContain("Halbfinale");
  });

  it("Top 1 per group reduces main bracket to only group winners", () => {
    const p = computePreview({
      participantCount: 8,
      groupSize: 4,
      luckyLoserEnabled: true,
      groupAdvancementCount: 1,
    });
    expect(p.groupCount).toBe(2);
    expect(p.koSize).toBe(2);
    expect(p.koMatches).toBe(1);
    // 3 non-qualifiers per group = 6 in loser bracket → size 8.
    expect(p.losersPoolSize).toBe(6);
    expect(p.losersKoSize).toBe(8);
  });

  it("12 players at groupSize 4: 3 groups → KO with 6 main qualifiers", () => {
    const p = computePreview({
      participantCount: 12,
      groupSize: 4,
      luckyLoserEnabled: true,
    });
    expect(p.groupCount).toBe(3);
    // Top 2 from 3 groups = 6 → next power of two is 8.
    expect(p.koSize).toBe(8);
    expect(p.losersPoolSize).toBe(6);
    expect(p.losersKoSize).toBe(8);
    expect(p.summary).toContain("Viertelfinale");
    expect(p.summary).toContain("Trostrunde");
  });

  it("with luckyLoserEnabled=false, no secondary bracket", () => {
    const p = computePreview({
      participantCount: 12,
      groupSize: 4,
      luckyLoserEnabled: false,
    });
    expect(p.losersPoolSize).toBe(0);
    expect(p.losersKoSize).toBe(0);
    expect(p.summary).not.toContain("Trostrunde");
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

describe("computePreview — structure-specific", () => {
  it("round_robin: one group with C(N,2) matches, no KO", () => {
    const p = computePreview({
      participantCount: 6,
      groupSize: 4,
      luckyLoserEnabled: true,
      structure: "round_robin",
    });
    expect(p.structure).toBe("round_robin");
    expect(p.groupCount).toBe(1);
    expect(p.groupMatches).toBe(15);
    expect(p.hasKO).toBe(false);
    expect(p.totalMatches).toBe(15);
    expect(p.summary).toMatch(/Jeder gegen jeden/);
  });

  it("ko_only: bracket size = next power of two, byes = size - N", () => {
    const p = computePreview({
      participantCount: 5,
      groupSize: 4,
      luckyLoserEnabled: true,
      structure: "ko_only",
    });
    expect(p.structure).toBe("ko_only");
    expect(p.koSize).toBe(8);
    expect(p.koMatches).toBe(7);
    expect(p.totalMatches).toBe(7);
    expect(p.summary).toContain("KO-Baum");
    expect(p.summary).toContain("+3 Freilos");
  });

  it("ko_only: 8 players produces a Viertelfinale start without byes", () => {
    const p = computePreview({
      participantCount: 8,
      groupSize: 4,
      luckyLoserEnabled: true,
      structure: "ko_only",
    });
    expect(p.koSize).toBe(8);
    expect(p.summary).not.toContain("Freilos");
  });

  it("swiss: rounds × matchesPerRound plus bye count", () => {
    const p = computePreview({
      participantCount: 9,
      groupSize: 4,
      luckyLoserEnabled: true,
      structure: "swiss",
      swissRounds: 5,
    });
    expect(p.structure).toBe("swiss");
    expect(p.swissRounds).toBe(5);
    expect(p.swissMatchesPerRound).toBe(4);
    expect(p.swissByesPerRound).toBe(1);
    expect(p.totalMatches).toBe(20);
    expect(p.summary).toContain("Schweizer System");
    expect(p.summary).toContain("5 Runden");
  });

  it("swiss: falls back to suggested rounds when not provided", () => {
    const p = computePreview({
      participantCount: 16,
      groupSize: 4,
      luckyLoserEnabled: true,
      structure: "swiss",
    });
    expect(p.swissRounds).toBeGreaterThanOrEqual(3);
  });

  it("structure: 'round_robin' requires only 2 players (not 4)", () => {
    const p = computePreview({
      participantCount: 2,
      groupSize: 4,
      luckyLoserEnabled: true,
      structure: "round_robin",
    });
    expect(p.groupCount).toBe(1);
    expect(p.totalMatches).toBe(1);
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
