// -----------------------------------------------------------------------------
// KO-only tournament format plugin.
//
// Builds a single-elimination bracket straight from a participant list, no
// group phase. Seeding follows the classic "top vs bottom" pattern:
//   1 vs 16, 8 vs 9, 5 vs 12, 4 vs 13, 3 vs 14, 6 vs 11, 7 vs 10, 2 vs 15.
// Top seeds are placed so that the two highest seeds can only meet in the
// final, the top four only in the semis, etc.
//
// Byes are awarded to the highest seeds when the participant count is not a
// power of two, so every match in round 0 is either a real pairing or an
// explicit bye (a player paired with an empty slot auto-advances).
// -----------------------------------------------------------------------------

import type { SeededPlayer } from "./draw";
import { createRng, shuffle } from "./rng";
import { nextPowerOfTwo } from "./bracket";
import type {
  Bracket,
  BracketMatch,
  BracketSlot,
  MatchSideWinner,
  Player,
} from "./types";

export type KoOnlyInput = {
  players: SeededPlayer[];
  /** Seed for shuffling unseeded players. Ignored when all players are seeded. */
  seed?: number | string;
};

export type BuiltKoOnly = Bracket & {
  /** 1-based seed order used to fill bracket positions (top seeds first). */
  seedOrder: Player[];
};

/**
 * Seeding positions for a bracket of `size` (a power of two). Returns an
 * array where position `i` is the seed index (0-based) that should be placed
 * into bracket slot `i`. For size 4: [0, 3, 1, 2] → seeds (1, 4, 2, 3).
 *
 * Recurrence: for size 2n, take positions for size n and for each `p` emit
 * `p` and `(2n - 1 - p)`. Classic bracket pairing.
 */
export function seedingOrder(size: number): number[] {
  if (size <= 1) return [0];
  let order = [0, 1];
  while (order.length < size) {
    const n2 = order.length * 2;
    const next: number[] = [];
    for (const p of order) {
      next.push(p);
      next.push(n2 - 1 - p);
    }
    order = next;
  }
  return order;
}

function labelForRound(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round - 1;
  if (fromEnd === 0) return "Finale";
  if (fromEnd === 1) return "Halbfinale";
  if (fromEnd === 2) return "Viertelfinale";
  if (fromEnd === 3) return "Achtelfinale";
  return `${round + 1}. Runde`;
}

/**
 * Build a seeded single-elimination bracket from a player pool.
 *
 * Pool ordering: players with a numeric `seed` come first (ascending), then
 * unseeded players in shuffled order (deterministic if a `seed` option is
 * passed). Byes fill the trailing bracket positions — the top seed gets the
 * first bye, etc.
 */
export function buildKoOnly(input: KoOnlyInput): BuiltKoOnly {
  const n = input.players.length;
  if (n < 2) {
    return { size: 0, matches: [], seedOrder: [] };
  }
  const size = nextPowerOfTwo(n);

  // Rank pool: seeded asc, then unseeded shuffled (but stable w.r.t. given
  // order when no rng seed is provided).
  const seeded = input.players
    .filter((p) => typeof p.seed === "number")
    .slice()
    .sort(
      (a, b) =>
        (a.seed as number) - (b.seed as number) ||
        a.name.localeCompare(b.name, "de"),
    );
  const unseededRaw = input.players.filter((p) => typeof p.seed !== "number");
  const rng = createRng(input.seed ?? input.players.map((p) => p.id).join("|"));
  const unseeded = shuffle(unseededRaw, rng);
  const ordered: SeededPlayer[] = [...seeded, ...unseeded];

  // Place by seeding order into size-sized slots. Missing players → empty.
  const order = seedingOrder(size);
  const slots: BracketSlot[] = new Array(size);
  for (let pos = 0; pos < size; pos++) {
    const seedIdx = order[pos]!;
    const p = ordered[seedIdx];
    slots[pos] = p
      ? {
          kind: "player",
          playerId: p.id,
          source: { type: "winner", groupLabel: `Setzliste ${seedIdx + 1}` },
        }
      : { kind: "empty" };
  }

  const totalRounds = Math.log2(size);
  const matches: BracketMatch[] = [];
  const round0Ids: string[] = [];
  for (let i = 0; i < size / 2; i++) {
    const id = matchId(0, i);
    round0Ids.push(id);
    matches.push({
      id,
      round: 0,
      matchIndex: i,
      label: labelForRound(0, totalRounds),
      a: slots[i * 2] ?? { kind: "empty" },
      b: slots[i * 2 + 1] ?? { kind: "empty" },
    });
  }

  let prev = round0Ids;
  for (let r = 1; r < totalRounds; r++) {
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const id = matchId(r, i / 2);
      next.push(id);
      matches.push({
        id,
        round: r,
        matchIndex: i / 2,
        label: labelForRound(r, totalRounds),
        a: { kind: "pending", fromMatchId: prev[i]! },
        b: { kind: "pending", fromMatchId: prev[i + 1]! },
      });
    }
    prev = next;
  }

  return {
    size,
    matches,
    seedOrder: ordered,
  };
}

/**
 * For round 0 matches where one side is empty (a bye), the player side auto-
 * wins. This helper resolves which bracket slot takes the bye.
 */
export function byeWinner(
  match: Pick<BracketMatch, "a" | "b">,
): MatchSideWinner | null {
  if (match.a.kind === "player" && match.b.kind === "empty") return "A";
  if (match.b.kind === "player" && match.a.kind === "empty") return "B";
  return null;
}

function matchId(round: number, idx: number): string {
  return `ko-r${round}-m${idx}`;
}
