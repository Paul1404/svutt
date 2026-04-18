import type { MatchOutcome, SetScore } from "./types";

export type SetRules = {
  /** Points needed to win a set under "clean" conditions (TT default: 11). */
  setPoints?: number;
  /** Required winning lead in a deuce (TT default: 2). */
  minLead?: number;
};

const DEFAULT_SET_POINTS = 11;
const DEFAULT_MIN_LEAD = 2;

/**
 * Returns `true` if a single set score is legal under the configured rules.
 * Defaults to standard TT (first to 11, win by 2 from 10:10).
 *
 * For setPoints=11, minLead=2 → valid: 11:0 … 11:9, 12:10, 13:11, 14:12.
 * Invalid in that configuration: 11:10, 12:9, 9:9, 10:10, 15:10.
 */
export function isValidSet(a: number, b: number, rules: SetRules = {}): boolean {
  const setPoints = rules.setPoints ?? DEFAULT_SET_POINTS;
  const minLead = rules.minLead ?? DEFAULT_MIN_LEAD;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0) return false;
  if (setPoints < 1 || minLead < 1) return false;
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  if (max < setPoints) return false;
  if (max - min < minLead) return false;
  // Clean win: winner exactly setPoints, loser <= setPoints-minLead.
  if (max === setPoints) return min <= setPoints - minLead;
  // Deuce: every additional point must be matched, so the lead must be exactly minLead.
  return max - min === minLead;
}

export function setWinner(set: SetScore, rules: SetRules = {}): "A" | "B" | null {
  if (!isValidSet(set.a, set.b, rules)) return null;
  return set.a > set.b ? "A" : "B";
}

/**
 * Compute the outcome of a match given its entered sets.
 * `winSets` defaults to 2 (best of 3). `rules` overrides per-set scoring.
 */
export function computeMatchOutcome(
  sets: SetScore[],
  winSets = 2,
  rules: SetRules = {},
): MatchOutcome {
  let setsA = 0;
  let setsB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let valid = true;
  let complete = false;
  let winner: "A" | "B" | null = null;

  const maxSets = winSets * 2 - 1;

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]!;
    pointsA += s.a;
    pointsB += s.b;
    if (!isValidSet(s.a, s.b, rules)) {
      valid = false;
      continue;
    }
    if (complete) {
      // Sets entered after the match is already decided are invalid.
      valid = false;
      continue;
    }
    if (s.a > s.b) setsA++;
    else setsB++;
    if (setsA === winSets) {
      winner = "A";
      complete = true;
    } else if (setsB === winSets) {
      winner = "B";
      complete = true;
    }
  }

  // Too many sets entered?
  if (sets.length > maxSets) valid = false;

  return { winner, setsA, setsB, pointsA, pointsB, complete, valid };
}

/**
 * Validate an entire match input, returning an array of human-readable errors.
 * An empty array means the input is acceptable.
 */
export function validateMatchInput(
  sets: SetScore[],
  winSets = 2,
  rules: SetRules = {},
): string[] {
  const errors: string[] = [];
  const maxSets = winSets * 2 - 1;
  if (sets.length < winSets) {
    errors.push(`Mindestens ${winSets} Sätze erforderlich.`);
  }
  if (sets.length > maxSets) {
    errors.push(`Maximal ${maxSets} Sätze erlaubt.`);
  }
  sets.forEach((s, i) => {
    if (!isValidSet(s.a, s.b, rules)) {
      errors.push(`Satz ${i + 1} ist ungültig (${s.a}:${s.b}).`);
    }
  });
  const outcome = computeMatchOutcome(sets, winSets, rules);
  if (errors.length === 0 && !outcome.complete) {
    errors.push("Spiel ist noch nicht entschieden.");
  }
  // Check: no sets played after the match was already decided.
  let declared = false;
  let a = 0;
  let b = 0;
  for (let i = 0; i < sets.length; i++) {
    if (declared) {
      errors.push(`Satz ${i + 1} wurde nach entschiedenem Spiel eingetragen.`);
      break;
    }
    const s = sets[i]!;
    if (!isValidSet(s.a, s.b, rules)) continue;
    if (s.a > s.b) a++;
    else b++;
    if (a === winSets || b === winSets) declared = true;
  }
  return errors;
}
