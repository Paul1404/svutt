import { computeGroupShape, nextPowerOfTwo } from "./engine";

export type StructurePreview = {
  participantCount: number;
  groupShape: number[];
  groupCount: number;
  groupMatches: number;
  hasKO: boolean;
  koSize: number;
  koMatches: number;
  luckyLoserSlots: number;
  totalMatches: number;
  estimatedMinutes: number;
  summary: string;
};

export type PreviewInput = {
  participantCount: number;
  groupSize: number;
  luckyLoserEnabled: boolean;
  matchDurationMinutes?: number;
  parallelTables?: number;
};

export function computePreview({
  participantCount,
  groupSize,
  luckyLoserEnabled,
  matchDurationMinutes = 11,
  parallelTables = 1,
}: PreviewInput): StructurePreview {
  if (participantCount < 2) {
    return {
      participantCount,
      groupShape: [],
      groupCount: 0,
      groupMatches: 0,
      hasKO: false,
      koSize: 0,
      koMatches: 0,
      luckyLoserSlots: 0,
      totalMatches: 0,
      estimatedMinutes: 0,
      summary: "Zu wenige Teilnehmer für einen Wettbewerb.",
    };
  }
  const shape = computeGroupShape(participantCount, groupSize);
  const groupCount = shape.length;
  const groupMatches = shape.reduce((acc, n) => acc + (n * (n - 1)) / 2, 0);

  const hasKO = groupCount >= 2;
  const koSize = hasKO ? nextPowerOfTwo(groupCount) : 0;
  const koMatches = koSize > 1 ? koSize - 1 : 0;
  const luckyLoserSlots =
    hasKO && luckyLoserEnabled ? Math.max(0, koSize - groupCount) : 0;

  const totalMatches = groupMatches + koMatches;
  const tables = Math.max(1, parallelTables);
  const duration = matchDurationMinutes > 0 ? matchDurationMinutes : 11;
  const estimatedMinutes = Math.ceil((totalMatches * duration) / tables);

  const summary = buildSummary(shape, groupCount, koSize, luckyLoserSlots, hasKO);

  return {
    participantCount,
    groupShape: shape,
    groupCount,
    groupMatches,
    hasKO,
    koSize,
    koMatches,
    luckyLoserSlots,
    totalMatches,
    estimatedMinutes,
    summary,
  };
}

function buildSummary(
  shape: number[],
  groupCount: number,
  koSize: number,
  luckyLoserSlots: number,
  hasKO: boolean,
): string {
  if (groupCount === 0) return "Keine Struktur möglich.";
  if (groupCount === 1) {
    return `1 Gruppe à ${shape[0]} — nur Gruppenphase, kein KO.`;
  }
  const sizes = new Set(shape);
  const groupPart =
    sizes.size === 1
      ? `${groupCount} Gruppen à ${shape[0]}`
      : `${groupCount} Gruppen à ${[...sizes].sort((a, b) => b - a).join("/")}`;
  if (!hasKO) return groupPart;
  const koLabel =
    koSize === 2
      ? "Finale"
      : koSize === 4
        ? "Halbfinale"
        : koSize === 8
          ? "Viertelfinale"
          : koSize === 16
            ? "Achtelfinale"
            : `Runde der ${koSize}`;
  const luckyPart =
    luckyLoserSlots > 0
      ? ` (+${luckyLoserSlots} Lucky Loser)`
      : luckyLoserSlots === 0 && koSize > groupCount
        ? ` (+${koSize - groupCount} Freilos)`
        : "";
  return `${groupPart} → ${koLabel}${luckyPart}`;
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  if (minutes < 60) return `ca. ${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `ca. ${h} h`;
  return `ca. ${h} h ${m} Min`;
}

/**
 * Suggest an optimal group size for the given participant count.
 * Prefers 4 (classic TT format). Falls back to whichever size produces the most
 * balanced grouping when 4 doesn't fit well.
 */
export function suggestGroupSize(participantCount: number): number {
  if (participantCount < 4) return Math.max(2, participantCount);
  const candidates = [4, 5, 3, 6, 7, 8];
  let best = 4;
  let bestScore = -Infinity;
  for (const size of candidates) {
    const shape = computeGroupShape(participantCount, size);
    if (shape.length === 0) continue;
    const minS = Math.min(...shape);
    const maxS = Math.max(...shape);
    const spread = maxS - minS;
    const avgDeviation = Math.abs(
      shape.reduce((a, b) => a + b, 0) / shape.length - size,
    );
    // prefer: low spread, close to preferred size, prefer 4
    const score =
      -spread * 10 -
      avgDeviation * 3 -
      Math.abs(size - 4) * 0.5 +
      (shape.length >= 2 && Number.isInteger(Math.log2(shape.length)) ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = size;
    }
  }
  return best;
}
