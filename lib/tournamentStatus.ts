import type { Category, Match } from "@/lib/db/schema";

export type DerivedStatus = "draft" | "running" | "finished";

/**
 * A category is "finished" when every playable match (both sides filled) is
 * done and, where applicable, the bracket has been built. Categories that
 * generate their bracket as a separate step (groups_ko, round_robin_finals)
 * stay in "running" until that bracket exists, even if every group match is
 * decided - the final still has to be played.
 *
 * `pending` shape lets callers pass either full Match rows or tiny aggregate
 * counts from a SQL query.
 */
export function isCategoryFinished(
  category: Pick<Category, "drawDone" | "bracketDone" | "structure">,
  pending: { totalPlayable: number; pendingPlayable: number },
): boolean {
  if (!category.drawDone) return false;
  if (
    (category.structure === "groups_ko" ||
      category.structure === "round_robin_finals") &&
    !category.bracketDone
  ) {
    return false;
  }
  return pending.totalPlayable > 0 && pending.pendingPlayable === 0;
}

export function categoryMatchCounts(
  matches: readonly Pick<
    Match,
    "status" | "participantAId" | "participantBId"
  >[],
): { totalPlayable: number; pendingPlayable: number } {
  let totalPlayable = 0;
  let pendingPlayable = 0;
  for (const m of matches) {
    if (m.participantAId === null || m.participantBId === null) continue;
    totalPlayable++;
    if (m.status !== "finished") pendingPlayable++;
  }
  return { totalPlayable, pendingPlayable };
}

/**
 * Derive a tournament-level status from its categories. "finished" requires
 * at least one finished category and all of them done; "running" needs at
 * least one drawn category; otherwise "draft".
 */
export function deriveTournamentStatus(
  catStatuses: readonly DerivedStatus[],
): DerivedStatus {
  if (catStatuses.length === 0) return "draft";
  if (catStatuses.every((s) => s === "finished")) return "finished";
  if (catStatuses.some((s) => s !== "draft")) return "running";
  return "draft";
}

export function categoryStatus(
  category: Pick<Category, "drawDone" | "bracketDone" | "structure">,
  pending: { totalPlayable: number; pendingPlayable: number },
): DerivedStatus {
  if (!category.drawDone) return "draft";
  if (isCategoryFinished(category, pending)) return "finished";
  return "running";
}
