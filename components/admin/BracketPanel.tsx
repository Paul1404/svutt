"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Category,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import { MatchResultDialog } from "./MatchResultDialog";

type Props = {
  tournamentId: string;
  category: Category;
  koMatches: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
  canBuild: boolean;
};

function formatTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function BracketPanel({
  category,
  koMatches,
  sets,
  participants,
  canBuild,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const rounds = useMemo(() => {
    const byRound = new Map<number, Match[]>();
    for (const m of koMatches) {
      const arr = byRound.get(m.round) ?? [];
      arr.push(m);
      byRound.set(m.round, arr);
    }
    const result: { round: number; matches: Match[] }[] = [];
    for (const [round, ms] of byRound) {
      ms.sort((a, b) => a.matchIndex - b.matchIndex);
      result.push({ round, matches: ms });
    }
    result.sort((a, b) => a.round - b.round);
    return result;
  }, [koMatches]);

  async function build() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${category.id}/bracket`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Erstellen des Baums.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const openMatch = koMatches.find((m) => m.id === openMatchId) ?? null;

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Finalphase (K.O.)</h2>
        <button
          type="button"
          className="btn-primary"
          disabled={!canBuild || loading}
          onClick={() => {
            if (
              koMatches.length > 0 &&
              !confirm(
                "Alle bestehenden K.O.-Spiele werden neu erstellt. Fortfahren?",
              )
            )
              return;
            build();
          }}
        >
          {loading
            ? "Baue…"
            : koMatches.length > 0
              ? "Bracket neu erstellen"
              : "Bracket erstellen"}
        </button>
      </div>

      {!canBuild && koMatches.length === 0 && (
        <p className="text-sm text-amber-700">
          Alle Gruppenspiele müssen erst abgeschlossen sein.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {rounds.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-6 min-w-max pb-2">
            {rounds.map((r) => (
              <div key={r.round} className="min-w-[220px] space-y-3">
                <div className="text-xs uppercase text-slate-500 font-semibold">
                  {r.matches[0]?.koLabel ?? `Runde ${r.round + 1}`}
                </div>
                {r.matches.map((m) => {
                  const a = partsById.get(m.participantAId ?? "");
                  const b = partsById.get(m.participantBId ?? "");
                  const matchSets = setsByMatch.get(m.id) ?? [];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="block w-full text-left card p-3 hover:border-brand-500"
                      onClick={() => {
                        if (m.participantAId && m.participantBId) {
                          setOpenMatchId(m.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className={a ? "" : "text-slate-400 italic"}>
                          {a?.name ?? "—"}
                        </span>
                        <span className="font-mono text-xs">
                          {m.status === "finished" ? m.setsA : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className={b ? "" : "text-slate-400 italic"}>
                          {b?.name ?? "—"}
                        </span>
                        <span className="font-mono text-xs">
                          {m.status === "finished" ? m.setsB : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-2">
                        Tisch {m.tableNumber ?? "?"} • {formatTime(m.scheduledAt)}
                        {matchSets.length > 0 && (
                          <> • {matchSets.map((s) => `${s.pointsA}:${s.pointsB}`).join(", ")}</>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {openMatch && openMatch.participantAId && openMatch.participantBId && (
        <MatchResultDialog
          match={openMatch}
          sets={setsByMatch.get(openMatch.id) ?? []}
          playerA={partsById.get(openMatch.participantAId)!}
          playerB={partsById.get(openMatch.participantBId)!}
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </section>
  );
}
