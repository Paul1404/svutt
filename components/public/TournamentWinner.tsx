import type { Match, Participant } from "@/lib/db/schema";
import type { GroupStanding } from "@/lib/engine/types";
import type { TournamentStructure } from "@/lib/engine/format";
import { Trophy, Sparkles } from "@/components/Icon";

type Props = {
  structure: TournamentStructure;
  participants: Participant[];
  matches: Match[];
  standings: GroupStanding[];
  swissRoundsTotal?: number;
};

type Winner = {
  participant: Participant;
  subtitle?: string;
};

function resolveWinner({
  structure,
  participants,
  matches,
  standings,
  swissRoundsTotal,
}: Props): Winner | null {
  const partsById = new Map(participants.map((p) => [p.id, p]));

  if (
    structure === "groups_ko" ||
    structure === "ko_only" ||
    structure === "round_robin_finals"
  ) {
    const koMatches = matches.filter((m) => m.stage === "ko");
    if (koMatches.length === 0) return null;
    const finale =
      koMatches.find(
        (m) => (m.koLabel ?? "").toLowerCase() === "finale",
      ) ??
      [...koMatches].sort((a, b) => b.round - a.round)[0];
    if (!finale || finale.status !== "finished" || !finale.winnerParticipantId)
      return null;
    const p = partsById.get(finale.winnerParticipantId);
    if (!p) return null;
    return { participant: p, subtitle: finale.koLabel ?? "Sieger" };
  }

  if (structure === "round_robin") {
    const groupMatches = matches.filter((m) => m.stage === "group");
    if (groupMatches.length === 0) return null;
    const allDone = groupMatches.every((m) => m.status === "finished");
    if (!allDone) return null;
    const leader = standings[0]?.rows[0];
    if (!leader) return null;
    const p = partsById.get(leader.playerId);
    if (!p) return null;
    if (leader.tied) return null;
    return {
      participant: p,
      subtitle: `${leader.wins}–${leader.losses} · ${leader.setsWon}:${leader.setsLost}`,
    };
  }

  if (structure === "swiss") {
    const swissMatches = matches.filter((m) => m.stage === "swiss");
    if (swissMatches.length === 0) return null;
    const maxRound = swissMatches.reduce((m, r) => Math.max(m, r.round), -1);
    const roundsPlayed = maxRound + 1;
    if (
      typeof swissRoundsTotal === "number" &&
      roundsPlayed < swissRoundsTotal
    )
      return null;
    const unfinished = swissMatches.filter(
      (m) => m.status !== "finished" && m.participantBId !== null,
    );
    if (unfinished.length > 0) return null;
    const leader = standings[0]?.rows[0];
    if (!leader) return null;
    const p = partsById.get(leader.playerId);
    if (!p) return null;
    if (leader.tied) return null;
    return { participant: p };
  }

  return null;
}

export function TournamentWinner(props: Props) {
  const winner = resolveWinner(props);
  if (!winner) return null;
  const { participant, subtitle } = winner;

  return (
    <section
      aria-label="Siegerin oder Sieger"
      className="winner-banner relative overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-50 p-6 sm:p-8 shadow-pop"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 text-amber-300/40"
      >
        <Trophy size={220} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-3 right-3 text-amber-500 winner-sparkle"
      >
        <Sparkles size={22} />
      </div>

      <div className="relative flex items-center gap-4 sm:gap-5">
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-white shadow-md ring-4 ring-amber-200">
          <Trophy size={32} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
            Turniersieger
          </div>
          <h2 className="mt-1 truncate text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-950">
            {participant.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-900/80">
            {participant.club && (
              <span className="font-medium">{participant.club}</span>
            )}
            {participant.club && subtitle && (
              <span className="text-amber-700/50">·</span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
