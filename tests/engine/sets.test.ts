import { describe, expect, it } from "vitest";
import {
  computeMatchOutcome,
  isValidSet,
  setWinner,
  validateMatchInput,
} from "@/lib/engine/sets";

describe("isValidSet", () => {
  it.each([
    [11, 0, true],
    [11, 5, true],
    [11, 9, true],
    [0, 11, true],
    [12, 10, true],
    [13, 11, true],
    [14, 12, true],
  ])("accepts legal scores %i:%i", (a, b, ok) => {
    expect(isValidSet(a, b)).toBe(ok);
  });

  it.each([
    [11, 10], // clean win requires loser <= 9
    [10, 10], // tie, unfinished
    [9, 9],
    [12, 9], // match should have ended at 11:9
    [15, 10], // loser >= 10, must win by exactly 2
    [15, 12], // diff=3, invalid
    [-1, 11],
    [10, -1],
    [11.5, 3],
  ])("rejects illegal score %s:%s", (a, b) => {
    expect(isValidSet(a as number, b as number)).toBe(false);
  });

  it("setWinner returns the correct side or null", () => {
    expect(setWinner({ a: 11, b: 3 })).toBe("A");
    expect(setWinner({ a: 7, b: 11 })).toBe("B");
    expect(setWinner({ a: 11, b: 10 })).toBeNull();
  });
});

describe("computeMatchOutcome", () => {
  it("declares A winner after 2:0", () => {
    const r = computeMatchOutcome([
      { a: 11, b: 3 },
      { a: 11, b: 7 },
    ]);
    expect(r.winner).toBe("A");
    expect(r.setsA).toBe(2);
    expect(r.setsB).toBe(0);
    expect(r.complete).toBe(true);
    expect(r.valid).toBe(true);
  });

  it("declares A winner after 2:1 (three sets)", () => {
    const r = computeMatchOutcome([
      { a: 11, b: 8 },
      { a: 7, b: 11 },
      { a: 11, b: 9 },
    ]);
    expect(r.winner).toBe("A");
    expect(r.setsA).toBe(2);
    expect(r.setsB).toBe(1);
    expect(r.pointsA).toBe(29);
    expect(r.pointsB).toBe(28);
    expect(r.complete).toBe(true);
    expect(r.valid).toBe(true);
  });

  it("rejects too many sets", () => {
    const r = computeMatchOutcome([
      { a: 11, b: 0 },
      { a: 11, b: 0 },
      { a: 11, b: 0 },
      { a: 11, b: 0 },
    ]);
    expect(r.valid).toBe(false);
  });

  it("rejects sets played after match was already decided", () => {
    const r = computeMatchOutcome([
      { a: 11, b: 3 },
      { a: 11, b: 5 },
      { a: 11, b: 9 },
    ]);
    expect(r.valid).toBe(false);
  });

  it("handles an incomplete match gracefully", () => {
    const r = computeMatchOutcome([{ a: 11, b: 3 }]);
    expect(r.winner).toBeNull();
    expect(r.complete).toBe(false);
  });

  it("accepts deuce set in third", () => {
    const r = computeMatchOutcome([
      { a: 9, b: 11 },
      { a: 13, b: 11 },
      { a: 14, b: 12 },
    ]);
    expect(r.winner).toBe("A");
    expect(r.valid).toBe(true);
  });
});

describe("validateMatchInput", () => {
  it("returns no errors for a legal match", () => {
    expect(
      validateMatchInput([
        { a: 11, b: 4 },
        { a: 11, b: 9 },
      ]),
    ).toEqual([]);
  });

  it("flags invalid individual sets", () => {
    const errors = validateMatchInput([
      { a: 11, b: 10 },
      { a: 11, b: 4 },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("Satz 1"))).toBe(true);
  });

  it("flags undecided match", () => {
    const errors = validateMatchInput([
      { a: 11, b: 8 },
      { a: 4, b: 11 },
    ]);
    expect(errors.some((e) => e.includes("nicht entschieden"))).toBe(true);
  });
});
