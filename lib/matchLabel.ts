/**
 * Short, organizer-friendly label for a match: the global game number
 * (`#12`) followed by the table (`T2`). The number is `playOrder + 1` so
 * the first scheduled match shows as `#1`, which is what an organizer
 * actually calls out over the microphone.
 *
 * Either component is omitted when the data is not present, so this works
 * on KO matches before the bracket has been scheduled too.
 */
export function matchLabel(m: {
  playOrder?: number | null;
  tableNumber?: number | null;
}): string {
  const parts: string[] = [];
  if (typeof m.playOrder === "number") parts.push(`#${m.playOrder + 1}`);
  if (typeof m.tableNumber === "number") parts.push(`T${m.tableNumber}`);
  return parts.join(" · ");
}

/** Just the game number (`#12`), or null when no playOrder is set yet. */
export function matchNumber(m: {
  playOrder?: number | null;
}): string | null {
  if (typeof m.playOrder !== "number") return null;
  return `#${m.playOrder + 1}`;
}
