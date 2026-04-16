import type { Player } from "./types";

export type PlannedMatch = {
  round: number; // 0-based
  matchIndex: number; // ordering within the whole round-robin
  a: Player;
  b: Player;
};

/**
 * Generate a single round-robin schedule for a group of players. Implements
 * the classical "circle" / Berger method, so rounds can be played in parallel
 * on different tables without a player playing twice per round.
 *
 * For even N: every player plays once per round.
 * For odd N: one player has a bye each round (we emit N rounds then).
 */
export function generateRoundRobin(players: Player[]): PlannedMatch[] {
  const n = players.length;
  if (n < 2) return [];

  const hasBye = n % 2 === 1;
  const size = hasBye ? n + 1 : n;
  // players[0] is the pivot; the remaining rotate.
  // For odd N, index `size - 1` is the BYE placeholder.
  const indices = Array.from({ length: size }, (_, i) => i);
  const rounds: PlannedMatch[] = [];
  let matchIndex = 0;

  const totalRounds = size - 1;
  let rotating = indices.slice(1); // mutable rotation buffer

  for (let r = 0; r < totalRounds; r++) {
    const roundPlayers = [indices[0]!, ...rotating];
    for (let i = 0; i < size / 2; i++) {
      const aIdx = roundPlayers[i]!;
      const bIdx = roundPlayers[size - 1 - i]!;
      if (aIdx >= n || bIdx >= n) continue; // BYE
      // Alternate A/B for fairness (home/away rotation).
      const [first, second] = i === 0 && r % 2 === 1 ? [bIdx, aIdx] : [aIdx, bIdx];
      rounds.push({
        round: r,
        matchIndex: matchIndex++,
        a: players[first]!,
        b: players[second]!,
      });
    }
    // Rotate: move last element to the front of the rotating slice.
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }

  return rounds;
}
