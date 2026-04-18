import { computeGroupShape, nextPowerOfTwo } from "./engine";
import type { TournamentStructure } from "./engine/format";
import { suggestedSwissRounds } from "./engine/swiss";

export type StructurePreview = {
  structure: TournamentStructure;
  participantCount: number;
  groupShape: number[];
  groupCount: number;
  groupMatches: number;
  hasKO: boolean;
  koSize: number;
  koMatches: number;
  luckyLoserSlots: number;
  swissRounds: number;
  swissMatchesPerRound: number;
  swissByesPerRound: number;
  totalMatches: number;
  estimatedMinutes: number;
  summary: string;
};

export type PreviewInput = {
  participantCount: number;
  groupSize: number;
  luckyLoserEnabled: boolean;
  structure?: TournamentStructure;
  swissRounds?: number;
  matchDurationMinutes?: number;
  parallelTables?: number;
};

export function computePreview({
  participantCount,
  groupSize,
  luckyLoserEnabled,
  structure = "groups_ko",
  swissRounds: swissRoundsInput,
  matchDurationMinutes = 11,
  parallelTables = 1,
}: PreviewInput): StructurePreview {
  const minPlayers = structure === "groups_ko" ? 4 : 2;
  const empty: StructurePreview = {
    structure,
    participantCount,
    groupShape: [],
    groupCount: 0,
    groupMatches: 0,
    hasKO: false,
    koSize: 0,
    koMatches: 0,
    luckyLoserSlots: 0,
    swissRounds: 0,
    swissMatchesPerRound: 0,
    swissByesPerRound: 0,
    totalMatches: 0,
    estimatedMinutes: 0,
    summary: "Zu wenige Teilnehmer für einen Wettbewerb.",
  };
  if (participantCount < minPlayers) return empty;

  const tables = Math.max(1, parallelTables);
  const duration = matchDurationMinutes > 0 ? matchDurationMinutes : 11;

  if (structure === "round_robin") {
    const shape = [participantCount];
    const groupMatches = (participantCount * (participantCount - 1)) / 2;
    const estimatedMinutes = Math.ceil((groupMatches * duration) / tables);
    return {
      structure,
      participantCount,
      groupShape: shape,
      groupCount: 1,
      groupMatches,
      hasKO: false,
      koSize: 0,
      koMatches: 0,
      luckyLoserSlots: 0,
      swissRounds: 0,
      swissMatchesPerRound: 0,
      swissByesPerRound: 0,
      totalMatches: groupMatches,
      estimatedMinutes,
      summary: `Jeder gegen jeden · ${groupMatches} Spiele, 1 Rangliste.`,
    };
  }

  if (structure === "ko_only") {
    const koSize = nextPowerOfTwo(participantCount);
    const koMatches = koSize - 1;
    const byes = koSize - participantCount;
    const estimatedMinutes = Math.ceil((koMatches * duration) / tables);
    const label = koRoundLabel(koSize);
    return {
      structure,
      participantCount,
      groupShape: [],
      groupCount: 0,
      groupMatches: 0,
      hasKO: true,
      koSize,
      koMatches,
      luckyLoserSlots: 0,
      swissRounds: 0,
      swissMatchesPerRound: 0,
      swissByesPerRound: 0,
      totalMatches: koMatches,
      estimatedMinutes,
      summary: `KO-Baum ${label}${byes > 0 ? ` (+${byes} Freilos)` : ""}.`,
    };
  }

  if (structure === "swiss") {
    const rounds = Math.max(
      1,
      swissRoundsInput ?? suggestedSwissRounds(participantCount),
    );
    const byesPerRound = participantCount % 2 === 1 ? 1 : 0;
    const matchesPerRound = Math.floor(participantCount / 2);
    const totalMatches = matchesPerRound * rounds;
    const estimatedMinutes = Math.ceil((totalMatches * duration) / tables);
    return {
      structure,
      participantCount,
      groupShape: [],
      groupCount: 0,
      groupMatches: 0,
      hasKO: false,
      koSize: 0,
      koMatches: 0,
      luckyLoserSlots: 0,
      swissRounds: rounds,
      swissMatchesPerRound: matchesPerRound,
      swissByesPerRound: byesPerRound,
      totalMatches,
      estimatedMinutes,
      summary: `Schweizer System · ${rounds} Runden à ${matchesPerRound} Spielen${
        byesPerRound > 0 ? " (je 1 Freilos)" : ""
      }.`,
    };
  }

  // default: groups_ko (original logic)
  const shape = computeGroupShape(participantCount, groupSize);
  const groupCount = shape.length;
  const groupMatches = shape.reduce((acc, n) => acc + (n * (n - 1)) / 2, 0);

  const hasKO = groupCount >= 2;
  const koSize = hasKO ? nextPowerOfTwo(groupCount) : 0;
  const koMatches = koSize > 1 ? koSize - 1 : 0;
  const luckyLoserSlots =
    hasKO && luckyLoserEnabled ? Math.max(0, koSize - groupCount) : 0;

  const totalMatches = groupMatches + koMatches;
  const estimatedMinutes = Math.ceil((totalMatches * duration) / tables);

  const summary = buildSummary(shape, groupCount, koSize, luckyLoserSlots, hasKO);

  return {
    structure,
    participantCount,
    groupShape: shape,
    groupCount,
    groupMatches,
    hasKO,
    koSize,
    koMatches,
    luckyLoserSlots,
    swissRounds: 0,
    swissMatchesPerRound: 0,
    swissByesPerRound: 0,
    totalMatches,
    estimatedMinutes,
    summary,
  };
}

function koRoundLabel(size: number): string {
  if (size <= 2) return "· nur Finale";
  if (size === 4) return "ab Halbfinale";
  if (size === 8) return "ab Viertelfinale";
  if (size === 16) return "ab Achtelfinale";
  return `ab Runde der ${size}`;
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
