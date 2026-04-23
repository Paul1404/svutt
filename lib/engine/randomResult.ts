import type { SetScore } from "./types";

/**
 * Generate a random, valid set score where the given side wins.
 * Favours clean wins (11:x with x ≤ setPoints - minLead); occasionally
 * produces a deuce (e.g. 13:11) to make test data look realistic.
 */
function randomSet(
  aWins: boolean,
  setPoints: number,
  minLead: number,
  rand: () => number,
): SetScore {
  const deuceChance = 0.15;
  const deuce = rand() < deuceChance;
  if (deuce) {
    // Winner = setPoints + k, loser = setPoints + k - minLead, k >= 1.
    const extra = 1 + Math.floor(rand() * 3); // 1..3 extra rallies
    const winnerPoints = setPoints - minLead + extra + minLead; // = setPoints + extra
    const loserPoints = winnerPoints - minLead;
    return aWins
      ? { a: winnerPoints, b: loserPoints }
      : { a: loserPoints, b: winnerPoints };
  }
  const maxLoser = Math.max(0, setPoints - minLead);
  const loser = Math.floor(rand() * (maxLoser + 1));
  return aWins ? { a: setPoints, b: loser } : { a: loser, b: setPoints };
}

/**
 * Generate a plausible sequence of sets for a match under the given rules.
 * Each set is won by either side with equal probability; the match ends
 * as soon as one side reaches `winSets` set wins.
 */
export function generateRandomMatchSets({
  winSets,
  setPoints,
  minLead,
  rand = Math.random,
}: {
  winSets: number;
  setPoints: number;
  minLead: number;
  rand?: () => number;
}): SetScore[] {
  const sets: SetScore[] = [];
  let a = 0;
  let b = 0;
  while (a < winSets && b < winSets) {
    const aWins = rand() < 0.5;
    sets.push(randomSet(aWins, setPoints, minLead, rand));
    if (aWins) a++;
    else b++;
  }
  return sets;
}
