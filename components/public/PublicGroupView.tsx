import type {
  Group,
  GroupMember,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import type { GroupStanding } from "@/lib/engine/types";
import { ChevronDown } from "@/components/Icon";

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

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold tracking-tight">Gruppenphase</h2>

      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => {
          const standing = standings.find((s) => s.groupId === g.id);
          const gMatches = matches
            .filter((m) => m.groupId === g.id)
            .sort((a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0));
          const done = gMatches.filter((m) => m.status === "finished").length;
          return (
            <div key={g.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                <h3 className="font-semibold tracking-tight">
                  Gruppe {g.label}
                </h3>
                <span className="text-xs text-ink-500 tabular-nums">
                  {done}/{gMatches.length}
                </span>
              </div>

              {standing && (
                <div className="px-5 py-4 overflow-x-auto">
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
                              {partsById.get(r.playerId)?.name ?? "?"}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {r.wins}-{r.losses}
                            </td>
                            <td className="py-2 text-right tabular-nums text-ink-600">
                              {r.setsWon}:{r.setsLost}
                            </td>
                            <td className="py-2 text-right tabular-nums text-ink-600">
                              {r.pointDiff > 0 ? "+" : ""}
                              {r.pointDiff}
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
                    return (
                      <li key={m.id} className="px-5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm">
                            <span className="font-medium">
                              {a?.name ?? "?"}
                            </span>
                            <span className="text-ink-400 mx-1.5">vs</span>
                            <span className="font-medium">
                              {b?.name ?? "?"}
                            </span>
                          </span>
                          {finished ? (
                            <span className="tabular-nums font-mono text-sm font-bold text-brand-700">
                              {m.setsA}:{m.setsB}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-400 font-mono tabular-nums">
                              T{m.tableNumber ?? "?"}
                            </span>
                          )}
                        </div>
                        {matchSets.length > 0 && (
                          <div className="mt-0.5 text-[11px] text-ink-500 font-mono tabular-nums">
                            {matchSets
                              .map((s) => `${s.pointsA}:${s.pointsB}`)
                              .join(", ")}
                          </div>
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
