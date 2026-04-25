"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Category,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import {
  computeSwissStandings,
  type SwissHistoryMatch,
} from "@/lib/engine/swiss";
import type { SeededPlayer } from "@/lib/engine/draw";
import { ChevronDown, Trophy } from "@/components/Icon";
import { MatchResultDialog } from "./MatchResultDialog";
import { useToast } from "@/components/Toast";
import { HelpTooltip } from "@/components/Tooltip";

type Props = {
  category: Category;
  swissMatches: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
};

export function SwissPanel({
  category,
  swissMatches,
  sets,
  participants,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const setsByMatch = useMemo(() => {
    const m = new Map<string, MatchSetRow[]>();
    for (const s of sets) {
      const arr = m.get(s.matchId) ?? [];
      arr.push(s);
      m.set(s.matchId, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.setNumber - b.setNumber);
    return m;
  }, [sets]);

  const rounds = useMemo(() => {
    const byRound = new Map<number, Match[]>();
    for (const m of swissMatches) {
      const arr = byRound.get(m.round) ?? [];
      arr.push(m);
      byRound.set(m.round, arr);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, ms]) => ({
        round,
        matches: ms.sort((a, b) => a.matchIndex - b.matchIndex),
      }));
  }, [swissMatches]);

  const maxRound = rounds.length > 0 ? rounds[rounds.length - 1]!.round : -1;
  const lastRoundFinished =
    maxRound < 0
      ? false
      : rounds[rounds.length - 1]!.matches.every(
          (m) => m.status === "finished" || m.participantBId === null,
        );
  const canAdvance = lastRoundFinished && maxRound + 1 < category.swissRounds;
  const totalDone = maxRound + 1 >= category.swissRounds && lastRoundFinished;

  const standings = useMemo(() => {
    const players: SeededPlayer[] = participants.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club ?? undefined,
      seed: p.seed ?? null,
    }));
    const history: SwissHistoryMatch[] = swissMatches.map((m) => ({
      round: m.round,
      a: m.participantAId!,
      b: m.participantBId,
      sets: (setsByMatch.get(m.id) ?? []).map((s) => ({
        a: s.pointsA,
        b: s.pointsB,
      })),
    }));
    return computeSwissStandings(players, history);
  }, [participants, swissMatches, setsByMatch]);

  async function advance() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${category.id}/swiss/round`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nächste Runde konnte nicht erstellt werden.");
        return;
      }
      toast.show({ message: `Runde ${data.round + 1} erstellt.` });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const openMatch = swissMatches.find((m) => m.id === openMatchId) ?? null;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Schweizer System
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {totalDone
              ? "Alle Runden gespielt. Die Rangliste zählt."
              : `Runde ${maxRound + 1} von ${category.swissRounds}`}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!canAdvance || loading}
          onClick={advance}
        >
          {loading
            ? "Wird geplant..."
            : totalDone
              ? "Turnier beendet"
              : !lastRoundFinished
                ? "Erst Runde abschließen"
                : "Nächste Runde auslosen"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
          <h3 className="font-semibold tracking-tight inline-flex items-center gap-2">
            <Trophy size={16} className="text-brand-600" />
            Rangliste
            <HelpTooltip label="Schweizer Rangliste">
              Punkte: 1 pro Sieg (inkl. Freilos). Tiebreaker:{" "}
              <strong>Buchholz</strong> (Summe der Punkte aller bisherigen
              Gegner), dann <strong>Sonneborn-Berger</strong> (Summe der
              Punkte der besiegten Gegner), dann Satzdifferenz, dann
              Setzplatz.
            </HelpTooltip>
          </h3>
        </div>
        <div className="px-5 py-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-500">
                <th className="pb-2 w-8 font-semibold">#</th>
                <th className="pb-2 font-semibold">Spieler</th>
                <th className="pb-2 text-right font-semibold">Pkt</th>
                <th className="pb-2 text-right font-semibold">Buch.</th>
                <th className="pb-2 text-right font-semibold">SB</th>
                <th className="pb-2 text-right font-semibold">S–N</th>
                <th className="pb-2 text-right font-semibold">Sätze</th>
              </tr>
            </thead>
            <tbody>
              {standings.rows.map((r) => (
                <tr
                  key={r.playerId}
                  id={`player-row-${r.playerId}`}
                  className="border-t border-ink-100"
                >
                  <td className="py-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-ink-500 text-[11px] font-bold">
                      {r.rank}
                    </span>
                  </td>
                  <td className="py-2 font-medium">
                    {partsById.get(r.playerId)?.name ?? "?"}
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold">
                    {r.score}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-500">
                    {r.buchholz}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-500">
                    {r.sonnebornBerger}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-600">
                    {r.wins}-{r.losses}
                    {r.byes > 0 && `+${r.byes}`}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-600">
                    {r.setsWon}:{r.setsLost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        {rounds.map((r) => (
          <details
            key={r.round}
            open={r.round === maxRound}
            className="card overflow-hidden group"
          >
            <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-ink-50 transition-colors list-none">
              <h3 className="font-semibold tracking-tight">
                Runde {r.round + 1}
                <span className="ml-2 text-xs font-normal text-ink-500">
                  {r.matches.filter((m) => m.status === "finished").length}/
                  {r.matches.filter((m) => m.participantBId !== null).length}
                </span>
              </h3>
              <span className="text-ink-400 transition-transform group-open:rotate-180">
                <ChevronDown size={16} />
              </span>
            </summary>
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {r.matches.map((m) => {
                const a = partsById.get(m.participantAId ?? "");
                const b = partsById.get(m.participantBId ?? "");
                const matchSets = setsByMatch.get(m.id) ?? [];
                const bye = m.participantBId === null;
                const finished = m.status === "finished";
                return (
                  <li key={m.id} className="px-2 py-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (!bye && m.participantAId && m.participantBId) {
                          setOpenMatchId(m.id);
                        }
                      }}
                      disabled={bye}
                      className="w-full text-left rounded-lg px-3 py-2 hover:bg-ink-50 disabled:cursor-default transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">
                          <span className="font-medium">{a?.name ?? "?"}</span>
                          {bye ? (
                            <span className="text-ink-400 ml-2 text-xs italic">
                              Freilos
                            </span>
                          ) : (
                            <>
                              <span className="text-ink-400 mx-1.5">vs</span>
                              <span className="font-medium">
                                {b?.name ?? "?"}
                              </span>
                            </>
                          )}
                        </span>
                        {!bye && finished ? (
                          <span className="tabular-nums font-mono text-sm font-bold text-brand-700">
                            {m.setsA}:{m.setsB}
                          </span>
                        ) : !bye ? (
                          <span className="text-xs text-ink-400 font-mono tabular-nums">
                            T{m.tableNumber ?? "?"}
                          </span>
                        ) : null}
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
          </details>
        ))}
      </div>

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
