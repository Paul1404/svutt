"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { StandingsExplainer } from "@/components/StandingsExplainer";
import { StandingsCellTooltip } from "@/components/StandingsCellTooltip";
import { useToast } from "@/components/Toast";
import { computeBreakdownsByPlayer } from "@/lib/engine/standings-breakdown";

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

export function GroupsPanel({
  category,
  groups,
  members,
  participants,
  matches,
  sets,
  standings,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const advancementCount = category.groupAdvancementCount ?? 2;
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
  const breakdownsByPlayer = useMemo(
    () => computeBreakdownsByPlayer(matches, sets, partsById),
    [matches, sets, partsById],
  );

  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const openMatch = matches.find((m) => m.id === openMatchId) ?? null;

  const totalMatches = matches.length;
  const finished = matches.filter((m) => m.status === "finished").length;
  // Drag + drop between groups is only safe before any match has been
  // touched AND before the KO bracket exists; either would invalidate
  // results the admin probably cares about.
  const anyTouched = matches.some((m) => m.status !== "pending");
  const canMove =
    category.structure === "groups_ko" &&
    !anyTouched &&
    !category.bracketDone;

  const [dragParticipantId, setDragParticipantId] = useState<string | null>(
    null,
  );
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  async function movePlayer(participantId: string, targetGroupId: string) {
    setMoving(true);
    try {
      const res = await fetch(`/api/categories/${category.id}/groups/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, targetGroupId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show({
          message:
            typeof data?.error === "string"
              ? data.error
              : "Verschieben fehlgeschlagen.",
        });
        return;
      }
      const p = partsById.get(participantId);
      toast.show({
        message: data.unchanged
          ? "Spieler war bereits in der Gruppe."
          : `${p?.name ?? "Spieler"} in Gruppe ${data.to} verschoben.`,
      });
      router.refresh();
    } finally {
      setMoving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Gruppenphase
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {canMove
              ? "Tippe auf ein Spiel, um das Ergebnis einzutragen. Spieler lassen sich per Drag & Drop zwischen Gruppen verschieben, solange noch nichts gespielt wurde."
              : "Tippe auf ein Spiel, um das Ergebnis einzutragen."}
          </p>
        </div>
        <div className="text-sm text-ink-600">
          <span className="font-semibold tabular-nums">{finished}</span>
          <span className="text-ink-400"> / {totalMatches} Spielen fertig</span>
        </div>
      </div>

      <StandingsExplainer />

      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => {
          const gMembers = members
            .filter((m) => m.groupId === g.id)
            .sort((a, b) => a.position - b.position);
          const gMatches = matches.filter((m) => m.groupId === g.id);
          const gDone = gMatches.every((m) => m.status === "finished");
          const standing = standings.find((s) => s.groupId === g.id);
          const isDragTarget =
            canMove && dragOverGroupId === g.id && dragParticipantId !== null;
          return (
            <div
              key={g.id}
              className={`card overflow-hidden transition-colors ${
                isDragTarget ? "ring-2 ring-brand-400 bg-brand-50/40" : ""
              }`}
              onDragOver={(e) => {
                if (!canMove || dragParticipantId === null) return;
                e.preventDefault();
                setDragOverGroupId(g.id);
              }}
              onDragLeave={() => {
                if (dragOverGroupId === g.id) setDragOverGroupId(null);
              }}
              onDrop={(e) => {
                if (!canMove || dragParticipantId === null) return;
                e.preventDefault();
                const pid = dragParticipantId;
                setDragParticipantId(null);
                setDragOverGroupId(null);
                movePlayer(pid, g.id);
              }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                <h3 className="font-semibold tracking-tight">
                  Gruppe {g.label}
                </h3>
                <span
                  className={
                    gDone && gMatches.length > 0
                      ? "badge-green"
                      : "badge-slate"
                  }
                >
                  {gDone && gMatches.length > 0
                    ? "Abgeschlossen"
                    : `${gMembers.length} Spieler`}
                </span>
              </div>

              {standing && (
                <div className="px-5 py-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-ink-500">
                        <th className="py-1.5 w-8 font-semibold">Platz</th>
                        <th className="py-1.5 font-semibold">Spieler</th>
                        <th className="py-1.5 text-right font-semibold">S</th>
                        <th className="py-1.5 text-right font-semibold">
                          Sätze
                        </th>
                        <th className="py-1.5 text-right font-semibold">
                          Pkt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {standing.rows.map((r) => {
                        const isQualifier = r.rank <= advancementCount;
                        const isDragging = dragParticipantId === r.playerId;
                        const breakdowns =
                          breakdownsByPlayer.get(r.playerId) ?? [];
                        return (
                          <tr
                            key={r.playerId}
                            className={`border-t border-ink-100 ${
                              canMove ? "cursor-grab" : ""
                            } ${isDragging ? "opacity-40" : ""} ${
                              moving && isDragging ? "animate-pulse" : ""
                            }`}
                            draggable={canMove && !moving}
                            onDragStart={(e) => {
                              if (!canMove) return;
                              setDragParticipantId(r.playerId);
                              e.dataTransfer.effectAllowed = "move";
                              // Set payload so browsers with strict DnD
                              // validation (Firefox) actually initiate the
                              // drag — the value itself is not used.
                              e.dataTransfer.setData("text/plain", r.playerId);
                            }}
                            onDragEnd={() => {
                              setDragParticipantId(null);
                              setDragOverGroupId(null);
                            }}
                            title={canMove ? "Ziehen, um Gruppe zu wechseln" : undefined}
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
                              <span className="inline-flex items-center gap-1.5">
                                {canMove && (
                                  <span
                                    aria-hidden
                                    className="text-ink-300 select-none"
                                  >
                                    ⋮⋮
                                  </span>
                                )}
                                {partsById.get(r.playerId)?.name ?? "?"}
                              </span>
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

              <div className="px-5 py-4 border-t border-ink-100">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
                  Spiele
                </h4>
                <ul className="space-y-1">
                  {gMatches
                    .slice()
                    .sort(
                      (a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0),
                    )
                    .map((m) => {
                      const a = partsById.get(m.participantAId ?? "");
                      const b = partsById.get(m.participantBId ?? "");
                      const matchSets = setsByMatch.get(m.id) ?? [];
                      const done = m.status === "finished";
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => setOpenMatchId(m.id)}
                            className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-ink-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1 text-sm">
                                <span className="font-medium">
                                  {a?.name ?? "?"}
                                </span>
                                <span className="text-ink-400 mx-1.5">vs</span>
                                <span className="font-medium">
                                  {b?.name ?? "?"}
                                </span>
                              </div>
                              {done ? (
                                <span className="tabular-nums font-mono text-sm font-semibold text-brand-700">
                                  {m.setsA}:{m.setsB}
                                </span>
                              ) : (
                                <span className="text-xs text-ink-400 font-mono">
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
                          </button>
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
