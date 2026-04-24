import type { Player } from "./types";
import type { DrawMode } from "./format";
import { createRng, shuffle, type Rng } from "./rng";

export type SeededPlayer = Player & { seed?: number | null };

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
  /**
   * How to order players before distributing them into groups.
   * - "random" (default): shuffle using the RNG seed, then snake-distribute.
   * - "seeded_snake": sort by participants.seed asc (unseeded last, stable by
   *   insertion order), then snake-distribute. Produces a reproducible,
   *   strength-spread draw.
   * - "paste_order": keep the given player order and fill groups sequentially
   *   (first N into group A, next N into group B, …). No shuffling, no
   *   snake - good for pre-sorted lists pasted as-is.
   */
  drawMode?: DrawMode;
};

const GROUP_LABELS = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "I", "J", "K", "L", "M", "N", "O", "P",
];

/**
 * Compute group sizes: how many groups and how many players per group.
 *
 * Strategy: prefer the smaller group count (fewer, bigger groups) so each
 * player gets more group-phase matches. Bump to a larger group count when
 * `lower` yields groups meaningfully bigger than preferred:
 *   - For a single big group (lower === 1), tolerate up to preferred + 2
 *     (6 players at preferred 4 stays as one group of 6; 7 splits to 4+3).
 *   - Once we already have multiple groups (lower >= 2), tolerate only
 *     preferred + 1 before splitting further (23 at preferred 6 becomes
 *     4 groups of [6,6,6,5] instead of 3 groups of [8,8,7]).
 *
 * Players are distributed as evenly as possible: the spread between the
 * largest and smallest group is never more than 1.
 */
export function computeGroupShape(
  totalPlayers: number,
  preferredGroupSize: number,
): number[] {
  if (totalPlayers <= 0) return [];
  if (preferredGroupSize < 2) preferredGroupSize = 2;
  const lower = Math.max(1, Math.floor(totalPlayers / preferredGroupSize));
  const upper = Math.max(1, Math.ceil(totalPlayers / preferredGroupSize));
  const lowerMaxSize = Math.ceil(totalPlayers / lower);
  const tolerance = lower === 1 ? 2 : 1;
  const numGroups =
    lowerMaxSize > preferredGroupSize + tolerance ? upper : lower;

  const base = Math.floor(totalPlayers / numGroups);
  const remainder = totalPlayers % numGroups;
  return Array.from({ length: numGroups }, (_, i) =>
    i < remainder ? base + 1 : base,
  );
}

/**
 * Draw groups from the given player pool.
 *
 * For `drawMode: "seeded_snake"`, players are ordered by their `seed` field
 * (ascending, unseeded last, stable) and then snake-distributed so the top
 * seeds land in different groups. Otherwise the pool is shuffled deterministic-
 * ally by `opts.seed`.
 */
export function drawGroups(
  players: SeededPlayer[],
  opts: DrawOptions,
): DrawnGroup[] {
  const rng = createRng(opts.seed ?? players.map((p) => p.id).join("|"));
  const shape = computeGroupShape(players.length, opts.groupSize);
  if (shape.length === 0) return [];

  // "paste_order" fills groups sequentially in the input order: no shuffle,
  // no snake. The first group-size players go into group A, the next into
  // group B, and so on. This is the only mode that doesn't use the snake
  // distribution below.
  if (opts.drawMode === "paste_order") {
    const groups: Player[][] = [];
    let offset = 0;
    for (const size of shape) {
      groups.push(players.slice(offset, offset + size));
      offset += size;
    }
    return groups.map((ps, i) => ({
      label: groupLabel(i),
      position: i,
      players: ps,
    }));
  }

  const ordered =
    opts.drawMode === "seeded_snake"
      ? orderBySeed(players)
      : shuffle(players, rng);

  // Snake distribution: group 0,1,2,…,n-1, then n-1,…,1,0, then 0,…
  const groups: Player[][] = Array.from({ length: shape.length }, () => []);
  let dir = 1;
  let idx = 0;
  for (const player of ordered) {
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

/**
 * Stable sort: players with a `seed` first (asc), unseeded last in original
 * order. Seed 1 is the top seed.
 */
export function orderBySeed<T extends { seed?: number | null }>(
  players: readonly T[],
): T[] {
  return players
    .map((p, i) => ({ p, i }))
    .sort((x, y) => {
      const sx = typeof x.p.seed === "number" ? x.p.seed : Number.POSITIVE_INFINITY;
      const sy = typeof y.p.seed === "number" ? y.p.seed : Number.POSITIVE_INFINITY;
      if (sx !== sy) return sx - sy;
      return x.i - y.i;
    })
    .map((e) => e.p);
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
