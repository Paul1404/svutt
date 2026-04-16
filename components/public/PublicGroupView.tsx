import type {
  Group,
  GroupMember,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import type { GroupStanding } from "@/lib/engine/types";

type Props = {
  groups: Group[];
  members: GroupMember[];
  participants: Participant[];
  matches: Match[];
  sets: MatchSetRow[];
  standings: GroupStanding[];
};

function formatTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function PublicGroupView({
  groups,
  members,
  participants,
  matches,
  sets,
  standings,
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
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Gruppenphase</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => {
          const standing = standings.find((s) => s.groupId === g.id);
          const gMatches = matches
            .filter((m) => m.groupId === g.id)
            .sort((a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0));
          return (
            <div key={g.id} className="card p-4">
              <h3 className="font-semibold">Gruppe {g.label}</h3>
              {standing && (
                <table className="mt-2 w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left w-6">#</th>
                      <th className="text-left">Spieler</th>
                      <th className="text-right w-14">Siege</th>
                      <th className="text-right w-14">Sätze</th>
                      <th className="text-right w-14">Pkt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standing.rows.map((r) => (
                      <tr key={r.playerId} className="border-t">
                        <td className="py-1 font-mono">{r.rank}</td>
                        <td className="py-1">
                          {partsById.get(r.playerId)?.name ?? "?"}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {r.wins}-{r.losses}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {r.setsWon}:{r.setsLost}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {r.pointDiff > 0 ? "+" : ""}
                          {r.pointDiff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-slate-600">
                  Spielplan ({gMatches.length} Spiele)
                </summary>
                <ul className="mt-2 divide-y text-sm">
                  {gMatches.map((m) => {
                    const a = partsById.get(m.participantAId ?? "");
                    const b = partsById.get(m.participantBId ?? "");
                    const matchSets = setsByMatch.get(m.id) ?? [];
                    return (
                      <li key={m.id} className="py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {a?.name ?? "?"} vs {b?.name ?? "?"}
                          </span>
                          <span className="text-xs tabular-nums">
                            {m.status === "finished" ? (
                              <strong>
                                {m.setsA}:{m.setsB}
                              </strong>
                            ) : (
                              <span className="text-slate-400">
                                T{m.tableNumber ?? "?"} / {formatTime(m.scheduledAt)}
                              </span>
                            )}
                          </span>
                        </div>
                        {matchSets.length > 0 && (
                          <div className="text-[11px] text-slate-500 tabular-nums">
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
