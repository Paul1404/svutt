/**
 * Names are stored as "Nachname Vorname" (the format used on tournament
 * lists). For UI display in groups and brackets, swap so Vorname appears
 * first. The split is intentionally minimal: first whitespace token is the
 * Nachname, everything after is the Vorname (handles compound first names
 * like "Hans Peter"). Single-word names are returned unchanged.
 */
export function displayName(name: string): string {
  const trimmed = name.trim();
  const idx = trimmed.search(/\s/);
  if (idx === -1) return trimmed;
  const nachname = trimmed.slice(0, idx);
  const vorname = trimmed.slice(idx + 1).trim();
  if (!vorname) return nachname;
  return `${vorname} ${nachname}`;
}
