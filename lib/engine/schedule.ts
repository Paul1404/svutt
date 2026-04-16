import type { ScheduleConfig, ScheduledMatch } from "./types";

/**
 * Produce a static schedule: a wall-clock time and table number for every
 * match, in the provided play order.
 *
 * Formula (as specified):
 *   minuteOffset = floor(playIndex / parallelTables) * matchDurationMinutes
 *   tableNumber  = (playIndex % parallelTables) + 1
 *
 * No real-time adaptation — results just sit where they first landed.
 */
export function scheduleMatches(
  matchIds: readonly string[],
  config: ScheduleConfig,
): ScheduledMatch[] {
  const [h, m] = parseHHMM(config.startTime);
  const startMinutes = h * 60 + m;
  const tables = Math.max(1, config.parallelTables);
  const duration = Math.max(1, config.matchDurationMinutes);

  return matchIds.map((id, i) => {
    const slot = Math.floor(i / tables);
    const minuteOffset = slot * duration;
    const total = startMinutes + minuteOffset;
    return {
      matchId: id,
      playOrder: i,
      tableNumber: (i % tables) + 1,
      minuteOffset,
      wallClock: formatHHMM(total),
    };
  });
}

function parseHHMM(s: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!match) return [10, 0];
  const h = Math.min(23, Math.max(0, parseInt(match[1]!, 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2]!, 10)));
  return [h, m];
}

function formatHHMM(totalMinutes: number): string {
  const day = 24 * 60;
  const norm = ((totalMinutes % day) + day) % day;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
