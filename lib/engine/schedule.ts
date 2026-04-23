import type { ScheduleConfig, ScheduledMatch } from "./types";

/**
 * Assign a table number and play order to every match in the given play
 * order. We do NOT compute absolute wall-clock times — the tournament runs
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
