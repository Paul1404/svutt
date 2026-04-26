import type {
  Group,
  GroupMember,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import type { GroupStanding } from "@/lib/engine/types";
import { ChevronDown, Users } from "@/components/Icon";
import { PublicCallList } from "./PublicCallList";
import { StandingsExplainer } from "@/components/StandingsExplainer";
import { StandingsCellTooltip } from "@/components/StandingsCellTooltip";
import { MatchMeta } from "@/components/MatchMeta";
import { computeBreakdownsByPlayer } from "@/lib/engine/standings-breakdown";
import { displayName } from "@/lib/displayName";
import { matchLabel } from "@/lib/matchLabel";

type Props = {
  groups: Group[];
  members: GroupMember[];
  participants: Participant[];
  matches: Match[];
  sets: MatchSetRow[];
  standings: GroupStanding[];
  advancementCount: number;
};

export function PublicGroupView({
  groups,
  members,
  participants,
  matches,
  sets,
  standings,
  advancementCount,
}: Props) {
  const partsById = new Map(participants.map((p) => [p.id, p]));
  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const s of sets) {
    const a = setsByMatch.get(s.matchId) ?? [];
    a.push(s);
    setsByMatch.set(s.matchId, a);
  }
  for (const arr of setsByMatch.values())
    arr.sort((a, b) => a.setNumber - b.setNumber);
  const breakdownsByPlayer = computeBreakdownsByPlayer(
    matches,
    sets,
    partsById,
  );

  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="Spielplan"
        title="Gruppenphase"
        subtitle="Jeder gegen jeden. Die Bestplatzierten ziehen weiter."
        icon={<Users size={18} />}
      />

      <PublicCallList
        matches={matches}
        participants={participants}
        groups={groups}
      />

      <StandingsExplainer />

      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => {
          const standing = standings.find((s) => s.groupId === g.id);
          const gMatches = matches
            .filter((m) => m.groupId === g.id)
            .sort((a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0));
          const done = gMatches.filter((m) => m.status === "finished").length;
          const allDone = gMatches.length > 0 && done === gMatches.length;
          return (
            <div key={g.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                <h3 className="font-semibold tracking-tight">
                  Gruppe {g.label}
                </h3>
                {allDone ? (
                  <span className="badge-green">Abgeschlossen</span>
                ) : (
                  <span className="text-xs text-ink-500 tabular-nums">
                    {done}/{gMatches.length}
                  </span>
                )}
              </div>

              {standing && (
                <div className="px-5 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-ink-500">
                        <th className="pb-2 w-8 font-semibold">#</th>
                        <th className="pb-2 font-semibold">Spieler</th>
                        <th className="pb-2 text-right font-semibold">Siege</th>
                        <th className="pb-2 text-right font-semibold">Sätze</th>
                        <th className="pb-2 text-right font-semibold">Pkt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standing.rows.map((r) => {
                        const isQualifier = r.rank <= advancementCount;
                        const breakdowns =
                          breakdownsByPlayer.get(r.playerId) ?? [];
                        return (
                          <tr
                            key={r.playerId}
                            className="border-t border-ink-100"
                          >
                            <td className="py-2">
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                                  isQualifier
                                    ? "bg-brand-600 text-white"
                                    : "bg-ink-100 text-ink-500"
                                }`}
                              >
                                {r.rank}
                              </span>
                            </td>
                            <td className="py-2 font-medium">
                              {(() => {
                                const n = partsById.get(r.playerId)?.name;
                                return n ? displayName(n) : "?";
                              })()}
                            </td>
                            <td className="py-2 text-right">
                              <StandingsCellTooltip
                                metric="wins"
                                breakdowns={breakdowns}
                                value={`${r.wins}-${r.losses}`}
                              />
                            </td>
                            <td className="py-2 text-right text-ink-600">
                              <StandingsCellTooltip
                                metric="sets"
                                breakdowns={breakdowns}
                                value={`${r.setsWon}:${r.setsLost}`}
                              />
                            </td>
                            <td className="py-2 text-right text-ink-600">
                              <StandingsCellTooltip
                                metric="points"
                                breakdowns={breakdowns}
                                value={`${r.pointDiff > 0 ? "+" : ""}${r.pointDiff}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="group border-t border-ink-100">
                <summary className="flex items-center justify-between px-5 py-3 cursor-pointer text-sm text-ink-600 hover:bg-ink-50 transition-colors list-none">
                  <span className="font-medium">
                    Spielplan ({gMatches.length})
                  </span>
                  <span className="text-ink-400 transition-transform group-open:rotate-180">
                    <ChevronDown size={16} />
                  </span>
                </summary>
                <ul className="divide-y divide-ink-100 border-t border-ink-100">
                  {gMatches.map((m) => {
                    const a = partsById.get(m.participantAId ?? "");
                    const b = partsById.get(m.participantBId ?? "");
                    const matchSets = setsByMatch.get(m.id) ?? [];
                    const finished = m.status === "finished";
                    const inProgress = m.played && !finished;
                    return (
                      <li
                        key={m.id}
                        className={`px-5 py-2.5 ${
                          inProgress ? "match-row-live" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm flex items-center gap-1.5 min-w-0">
                            <span className="font-medium truncate">
                              {a ? displayName(a.name) : "?"}
                            </span>
                            <span className="text-ink-400">gg.</span>
                            <span className="font-medium truncate">
                              {b ? displayName(b.name) : "?"}
                            </span>
                            {inProgress && (
                              <span className="badge-amber shrink-0">
                                Wird gespielt
                              </span>
                            )}
                          </span>
                          {finished ? (
                            <span className="flex items-center gap-1.5">
                              {m.forfeitedBy && (
                                <span className="badge-amber shrink-0">
                                  Disq.
                                </span>
                              )}
                              <span className="tabular-nums font-mono text-sm font-bold text-brand-700">
                                {m.setsA}:{m.setsB}
                              </span>
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                inProgress ? "match-row-live-meta" : "text-ink-400"
                              }`}
                            >
                              {matchLabel(m) || "—"}
                            </span>
                          )}
                        </div>
                        {finished && (
                          <MatchMeta
                            match={m}
                            sets={matchSets.map((s) => ({
                              pointsA: s.pointsA,
                              pointsB: s.pointsB,
                            }))}
                            className="mt-1.5"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  icon,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      <span className="mt-1 hidden sm:inline-block h-7 w-0.5 rounded-full bg-gradient-to-b from-brand-500 via-brand-400 to-brand-200" />
      {icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/60">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700">
          {eyebrow}
        </div>
        <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-ink-500 max-w-xl">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
