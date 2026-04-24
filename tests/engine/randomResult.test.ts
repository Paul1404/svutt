import { describe, expect, it } from "vitest";
import { computeMatchOutcome, validateMatchInput } from "@/lib/engine/sets";
import { generateRandomMatchSets } from "@/lib/engine/randomResult";

function makeRng(seed: number): () => number {
  // Mulberry32 - deterministic PRNG for repeatable tests.
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateRandomMatchSets", () => {
  it("produces a valid best-of-3 match", () => {
    const sets = generateRandomMatchSets({
      winSets: 2,
      setPoints: 11,
      minLead: 2,
      rand: makeRng(1),
    });
    expect(validateMatchInput(sets, 2, { setPoints: 11, minLead: 2 })).toEqual(
      [],
    );
    const outcome = computeMatchOutcome(sets, 2, { setPoints: 11, minLead: 2 });
    expect(outcome.complete).toBe(true);
    expect(outcome.valid).toBe(true);
    expect(outcome.winner).not.toBeNull();
  });

  it("produces a valid best-of-5 match", () => {
    const sets = generateRandomMatchSets({
      winSets: 3,
      setPoints: 11,
      minLead: 2,
      rand: makeRng(42),
    });
    expect(sets.length).toBeGreaterThanOrEqual(3);
    expect(sets.length).toBeLessThanOrEqual(5);
    expect(validateMatchInput(sets, 3, { setPoints: 11, minLead: 2 })).toEqual(
      [],
    );
  });

  it("produces valid matches across many seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const sets = generateRandomMatchSets({
        winSets: 2,
        setPoints: 11,
        minLead: 2,
        rand: makeRng(seed),
      });
      const errors = validateMatchInput(sets, 2, {
        setPoints: 11,
        minLead: 2,
      });
      expect(errors, `seed ${seed} produced ${JSON.stringify(sets)}`).toEqual(
        [],
      );
    }
  });

  it("respects custom set rules", () => {
    const sets = generateRandomMatchSets({
      winSets: 2,
      setPoints: 21,
      minLead: 2,
      rand: makeRng(7),
    });
    expect(validateMatchInput(sets, 2, { setPoints: 21, minLead: 2 })).toEqual(
      [],
    );
  });
});
