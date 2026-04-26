import type { ScheduleConfig, ScheduledMatch } from "./types";

/**
 * Assign a table number and play order to every match in the given play
 * order. We do NOT compute absolute wall-clock times - the tournament runs
 * in sequence, matches simply go in play order across the available tables.
 *
 *   tableNumber = (playIndex % parallelTables) + 1
 */
export function scheduleMatches(
  matchIds: readonly string[],
  config: ScheduleConfig,
): ScheduledMatch[] {
  const tables = Math.max(1, config.parallelTables);

  return matchIds.map((id, i) => ({
    matchId: id,
    playOrder: i,
    tableNumber: (i % tables) + 1,
  }));
}

export type SchedulableMatch = {
  id: string;
  /** Player IDs. Null sides are tolerated (e.g. KO bye) and ignored. */
  a: string | null;
  b: string | null;
};

/**
 * Reorder + schedule a set of matches so the same player does not play in
 * two consecutive time slots when it can be avoided. A "slot" is one round
 * of `parallelTables` matches running in parallel.
 *
 * Greedy fill: for each slot we first try to pick `parallelTables` matches
 * whose players did NOT play in the previous slot. If that yields nothing
 * (e.g. only matches involving last-slot players are left), we relax the
 * constraint so the schedule still makes progress. Within a slot, no player
 * appears in more than one match.
 *
 * Input order acts as a soft preference: matches earlier in the list are
 * picked first when both candidates would respect the rest constraint, so
 * a round-robin's natural round order tends to be preserved.
 */
export function scheduleMatchesWithRest(
  matches: readonly SchedulableMatch[],
  config: ScheduleConfig,
): ScheduledMatch[] {
  const tables = Math.max(1, config.parallelTables);
  const remaining = matches.slice();
  const out: ScheduledMatch[] = [];
  let prevSlot = new Set<string>();
  let playOrder = 0;

  const pick = (
    slot: SchedulableMatch[],
    players: Set<string>,
    allowConsecutive: boolean,
  ) => {
    for (let i = 0; i < remaining.length; ) {
      if (slot.length >= tables) break;
      const m = remaining[i]!;
      const sharesSlotPlayer =
        (m.a !== null && players.has(m.a)) ||
        (m.b !== null && players.has(m.b));
      const playedLastSlot =
        (m.a !== null && prevSlot.has(m.a)) ||
        (m.b !== null && prevSlot.has(m.b));
      if (sharesSlotPlayer || (!allowConsecutive && playedLastSlot)) {
        i++;
        continue;
      }
      slot.push(m);
      if (m.a !== null) players.add(m.a);
      if (m.b !== null) players.add(m.b);
      remaining.splice(i, 1);
    }
  };

  while (remaining.length > 0) {
    const slot: SchedulableMatch[] = [];
    const players = new Set<string>();

    pick(slot, players, false);
    if (slot.length === 0) pick(slot, players, true);

    for (let i = 0; i < slot.length; i++) {
      out.push({
        matchId: slot[i]!.id,
        playOrder: playOrder++,
        tableNumber: i + 1,
      });
    }
    prevSlot = players;
  }

  return out;
}
