import type { Player } from "./types";
import { createRng, shuffle, type Rng } from "./rng";

export type DrawnGroup = {
  label: string;
  position: number; // 0-based: A=0, B=1 …
  players: Player[];
};

export type DrawOptions = {
  /** Preferred group size, 4..8. Engine may deviate slightly to avoid tiny groups. */
  groupSize: number;
  /** Optional deterministic seed. */
  seed?: number | string;
};

const GROUP_LABELS = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "I", "J", "K", "L", "M", "N", "O", "P",
];

/**
 * Compute group sizes: how many groups and how many players per group.
 *
 * Strategy: never create a tiny group. Use `floor(N / preferred)` as the
 * number of groups, then distribute players as evenly as possible. Players
 * are added one-at-a-time to the smallest group first, so the spread is
 * never more than 1. Example: N=10 at preferred=4 → 2 groups of 5, not
 * 4 + 4 + 2.
 */
export function computeGroupShape(
  totalPlayers: number,
  preferredGroupSize: number,
): number[] {
  if (totalPlayers <= 0) return [];
  if (preferredGroupSize < 2) preferredGroupSize = 2;
  // At least one group; never so few groups that a group is 2x+ the preferred
  // size — cap at ceil(N / preferred) for very small preferred values.
  const lower = Math.max(1, Math.floor(totalPlayers / preferredGroupSize));
  const upper = Math.max(1, Math.ceil(totalPlayers / preferredGroupSize));
  // Prefer the `lower` count (fewer, bigger groups) to avoid undersized
  // groups like 4 + 2. Only bump to `upper` when `lower` gives groups larger
  // than `preferredGroupSize + 2` (e.g. 7 players with preferred=4 → 1 group
  // of 7 is too big, use 2 groups of 4+3).
  const lowerMaxSize = Math.ceil(totalPlayers / lower);
  const numGroups = lowerMaxSize > preferredGroupSize + 2 ? upper : lower;

  const base = Math.floor(totalPlayers / numGroups);
  const remainder = totalPlayers % numGroups;
  // First `remainder` groups get an extra player (largest first, stable).
  return Array.from({ length: numGroups }, (_, i) =>
    i < remainder ? base + 1 : base,
  );
}

/**
 * Draw groups from the given player pool.
 *
 * Distribution is snake-draft across groups when seeds exist (so Top seeds are
 * spread apart), otherwise a plain shuffle.
 */
export function drawGroups(
  players: Player[],
  opts: DrawOptions,
): DrawnGroup[] {
  const rng = createRng(opts.seed ?? players.map((p) => p.id).join("|"));
  const shape = computeGroupShape(players.length, opts.groupSize);
  if (shape.length === 0) return [];

  const shuffled = shuffle(players, rng);

  // Snake distribution: group 0,1,2,…,n-1, then n-1,…,1,0, then 0,…
  const groups: Player[][] = Array.from({ length: shape.length }, () => []);
  let dir = 1;
  let idx = 0;
  for (const player of shuffled) {
    // Skip full groups (can happen when sizes differ)
    let safety = shape.length * 2;
    while (groups[idx]!.length >= shape[idx]! && safety-- > 0) {
      idx += dir;
      if (idx === shape.length) {
        dir = -1;
        idx = shape.length - 1;
      } else if (idx === -1) {
        dir = 1;
        idx = 0;
      }
    }
    groups[idx]!.push(player);
    idx += dir;
    if (idx === shape.length) {
      dir = -1;
      idx = shape.length - 1;
    } else if (idx === -1) {
      dir = 1;
      idx = 0;
    }
  }

  return groups.map((ps, i) => ({
    label: groupLabel(i),
    position: i,
    players: ps,
  }));
}

export function groupLabel(index: number): string {
  if (index < GROUP_LABELS.length) return GROUP_LABELS[index]!;
  // Beyond P (16 groups), use AA, AB, …
  const first = Math.floor(index / GROUP_LABELS.length) - 1;
  const second = index % GROUP_LABELS.length;
  return `${GROUP_LABELS[first]!}${GROUP_LABELS[second]!}`;
}

// Re-export for callers who want to use the RNG for their own draws.
export type { Rng };
