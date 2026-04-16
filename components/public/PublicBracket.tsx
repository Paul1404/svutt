import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";

type Props = {
  koMatches: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
};

function formatTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function PublicBracket({ koMatches, sets, participants }: Props) {
  const partsById = new Map(participants.map((p) => [p.id, p]));
  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const s of sets) {
    const a = setsByMatch.get(s.matchId) ?? [];
    a.push(s);
    setsByMatch.set(s.matchId, a);
  }
  for (const arr of setsByMatch.values())
    arr.sort((a, b) => a.setNumber - b.setNumber);

  const byRound = new Map<number, Match[]>();
  for (const m of koMatches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  const rounds: { round: number; matches: Match[] }[] = [];
  for (const [round, ms] of byRound) {
    ms.sort((a, b) => a.matchIndex - b.matchIndex);
    rounds.push({ round, matches: ms });
  }
  rounds.sort((a, b) => a.round - b.round);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Finalbaum</h2>
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-4 min-w-max pb-2">
          {rounds.map((r) => (
            <div key={r.round} className="min-w-[220px] space-y-3">
              <div className="text-xs uppercase text-slate-500 font-semibold">
                {r.matches[0]?.koLabel ?? `Runde ${r.round + 1}`}
              </div>
              {r.matches.map((m) => {
                const a = partsById.get(m.participantAId ?? "");
                const b = partsById.get(m.participantBId ?? "");
                const matchSets = setsByMatch.get(m.id) ?? [];
                const winnerId = m.winnerParticipantId;
                return (
                  <div key={m.id} className="card p-3">
                    <Row
                      name={a?.name ?? "—"}
                      score={m.status === "finished" ? m.setsA : null}
                      winner={winnerId === m.participantAId}
                      placeholder={!a}
                    />
                    <Row
                      name={b?.name ?? "—"}
                      score={m.status === "finished" ? m.setsB : null}
                      winner={winnerId === m.participantBId}
                      placeholder={!b}
                    />
                    <div className="mt-2 text-[11px] text-slate-500">
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
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
    <div
      className={`flex items-center justify-between text-sm py-1 ${
        winner ? "font-semibold" : ""
      } ${placeholder ? "text-slate-400 italic" : ""}`}
    >
      <span className="truncate">{name}</span>
      <span className="font-mono text-xs tabular-nums">
        {score !== null ? score : ""}
      </span>
    </div>
  );
}
