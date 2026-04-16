"use client";

import { useMemo, useState } from "react";
import type {
  Category,
  Group,
  GroupMember,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import type { GroupStanding } from "@/lib/engine/types";
import { MatchResultDialog } from "./MatchResultDialog";

type Props = {
  tournamentId: string;
  category: Category;
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

export function GroupsPanel({
  groups,
  members,
  participants,
  matches,
  sets,
  standings,
}: Props) {
  const partsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const setsByMatch = useMemo(() => {
    const m = new Map<string, MatchSetRow[]>();
    for (const s of sets) {
      const a = m.get(s.matchId) ?? [];
      a.push(s);
      m.set(s.matchId, a);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.setNumber - b.setNumber);
    return m;
  }, [sets]);

  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const openMatch = matches.find((m) => m.id === openMatchId) ?? null;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Gruppenphase</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => {
          const gMembers = members
            .filter((m) => m.groupId === g.id)
            .sort((a, b) => a.position - b.position);
          const gMatches = matches.filter((m) => m.groupId === g.id);
          const standing = standings.find((s) => s.groupId === g.id);
          return (
            <div key={g.id} className="card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Gruppe {g.label}</h3>
                <span className="text-xs text-slate-500">
                  {gMembers.length} Spieler
                </span>
              </div>

              {standing && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-500">
                        <th className="py-1 w-8">#</th>
                        <th className="py-1">Spieler</th>
                        <th className="py-1 text-right">S</th>
                        <th className="py-1 text-right">Sätze</th>
                        <th className="py-1 text-right">Pkt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standing.rows.map((r) => (
                        <tr key={r.playerId} className="border-t">
                          <td className="py-1">{r.rank}</td>
                          <td className="py-1">
                            {partsById.get(r.playerId)?.name ?? "?"}
                          </td>
                          <td className="py-1 text-right">
                            {r.wins}-{r.losses}
                          </td>
                          <td className="py-1 text-right">
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
                </div>
              )}

              <div className="mt-4">
                <h4 className="text-xs uppercase text-slate-500 mb-2">
                  Spiele
                </h4>
                <ul className="divide-y text-sm">
                  {gMatches
                    .slice()
                    .sort(
                      (a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0),
                    )
                    .map((m) => {
                      const a = partsById.get(m.participantAId ?? "");
                      const b = partsById.get(m.participantBId ?? "");
                      const matchSets = setsByMatch.get(m.id) ?? [];
                      return (
                        <li
                          key={m.id}
                          className="py-2 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate">
                              {a?.name ?? "?"} vs {b?.name ?? "?"}
                            </div>
                            <div className="text-xs text-slate-500">
                              Tisch {m.tableNumber ?? "?"} •{" "}
                              {formatTime(m.scheduledAt)}
                              {matchSets.length > 0 && (
                                <>
                                  {" • "}
                                  {matchSets
                                    .map((s) => `${s.pointsA}:${s.pointsB}`)
                                    .join(", ")}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.status === "finished" && (
                              <span className="badge bg-green-100 text-green-800">
                                {m.setsA}:{m.setsB}
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              onClick={() => setOpenMatchId(m.id)}
                            >
                              {m.status === "finished"
                                ? "Bearbeiten"
                                : "Ergebnis"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {openMatch && (
        <MatchResultDialog
          match={openMatch}
          sets={setsByMatch.get(openMatch.id) ?? []}
          playerA={
            partsById.get(openMatch.participantAId ?? "") ?? {
              id: "",
              name: "?",
              club: null,
              seed: null,
              categoryId: "",
              createdAt: new Date(),
            }
          }
          playerB={
            partsById.get(openMatch.participantBId ?? "") ?? {
              id: "",
              name: "?",
              club: null,
              seed: null,
              categoryId: "",
              createdAt: new Date(),
            }
          }
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </section>
  );
}
