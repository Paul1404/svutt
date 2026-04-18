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
import { Trophy } from "@/components/Icon";

type Props = {
  tournamentId: string;
  category: Category;
  koMatches: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
  canBuild: boolean;
};

function formatTime(d: Date | string | null): string {
  if (!d) return "";
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
        setError(data.error ?? "Finalbaum konnte nicht erstellt werden.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const openMatch = koMatches.find((m) => m.id === openMatchId) ?? null;

  return (
    <section className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Finalrunde
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              K.O.-Baum mit den Gruppenbesten. Lucky Loser werden automatisch
              ergänzt.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!canBuild || loading}
          onClick={() => {
            if (
              koMatches.length > 0 &&
              !confirm(
                "Der bestehende Finalbaum wird komplett neu erstellt. Weiter?",
              )
            )
              return;
            build();
          }}
        >
          {loading
            ? "Wird erstellt..."
            : koMatches.length > 0
              ? "Neu aufbauen"
              : "Finalbaum erstellen"}
        </button>
      </div>

      {!canBuild && koMatches.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Erst alle Gruppenspiele abschließen, dann kannst du den Finalbaum
          starten.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {error}
        </div>
      )}

      {rounds.length > 0 && (
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="flex gap-6 min-w-max pb-2">
            {rounds.map((r) => (
              <div key={r.round} className="min-w-[240px] space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                  {r.matches[0]?.koLabel ?? `Runde ${r.round + 1}`}
                </div>
                {r.matches.map((m) => {
                  const a = partsById.get(m.participantAId ?? "");
                  const b = partsById.get(m.participantBId ?? "");
                  const matchSets = setsByMatch.get(m.id) ?? [];
                  const done = m.status === "finished";
                  const winnerA = m.winnerParticipantId === m.participantAId;
                  const winnerB = m.winnerParticipantId === m.participantBId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="block w-full text-left card-hover p-3"
                      onClick={() => {
                        if (m.participantAId && m.participantBId) {
                          setOpenMatchId(m.id);
                        }
                      }}
                    >
                      <Row
                        name={a?.name ?? "…"}
                        score={done ? m.setsA : null}
                        winner={winnerA}
                        placeholder={!a}
                      />
                      <div className="my-1 h-px bg-ink-100" />
                      <Row
                        name={b?.name ?? "…"}
                        score={done ? m.setsB : null}
                        winner={winnerB}
                        placeholder={!b}
                      />
                      <div className="mt-2.5 text-[11px] text-ink-500 font-mono tabular-nums">
                        T{m.tableNumber ?? "?"} {formatTime(m.scheduledAt)}
                        {matchSets.length > 0 && (
                          <>
                            {" · "}
                            {matchSets
                              .map((s) => `${s.pointsA}:${s.pointsB}`)
                              .join(", ")}
                          </>
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

function Row({
  name,
  score,
  winner,
  placeholder,
}: {
  name: string;
  score: number | null;
  winner: boolean;
  placeholder: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span
        className={`truncate ${
          placeholder ? "italic text-ink-400" : winner ? "font-bold" : ""
        }`}
      >
        {name}
      </span>
      <span
        className={`font-mono text-xs tabular-nums ${winner ? "font-bold text-brand-700" : "text-ink-500"}`}
      >
        {score !== null ? score : ""}
      </span>
    </div>
  );
}
