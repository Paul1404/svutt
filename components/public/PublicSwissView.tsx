import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";
import {
  computeSwissStandings,
  type SwissHistoryMatch,
} from "@/lib/engine/swiss";
import type { SeededPlayer } from "@/lib/engine/draw";
import { ChevronDown } from "@/components/Icon";

type Props = {
  participants: Participant[];
  matches: Match[];
  sets: MatchSetRow[];
};

function formatTime(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function PublicSwissView({ participants, matches, sets }: Props) {
  const partsById = new Map(participants.map((p) => [p.id, p]));
  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const s of sets) {
    const arr = setsByMatch.get(s.matchId) ?? [];
    arr.push(s);
    setsByMatch.set(s.matchId, arr);
  }
  for (const arr of setsByMatch.values())
    arr.sort((a, b) => a.setNumber - b.setNumber);

  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, ms]) => ({
      round,
      matches: ms.sort((a, b) => a.matchIndex - b.matchIndex),
    }));

  const players: SeededPlayer[] = participants.map((p) => ({
    id: p.id,
    name: p.name,
    club: p.club ?? undefined,
    seed: p.seed ?? null,
  }));
  const history: SwissHistoryMatch[] = matches.map((m) => ({
    round: m.round,
    a: m.participantAId!,
    b: m.participantBId,
    sets: (setsByMatch.get(m.id) ?? []).map((s) => ({
      a: s.pointsA,
      b: s.pointsB,
    })),
  }));
  const standings = computeSwissStandings(players, history);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Schweizer System</h2>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50">
          <h3 className="font-semibold tracking-tight">Rangliste</h3>
        </div>
        <div className="px-5 py-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-500">
                <th className="pb-2 w-8 font-semibold">#</th>
                <th className="pb-2 font-semibold">Spieler</th>
                <th className="pb-2 text-right font-semibold">Pkt</th>
                <th className="pb-2 text-right font-semibold">Buch.</th>
                <th className="pb-2 text-right font-semibold">S–N</th>
                <th className="pb-2 text-right font-semibold">Sätze</th>
              </tr>
            </thead>
            <tbody>
              {standings.rows.map((r) => (
                <tr key={r.playerId} className="border-t border-ink-100">
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
            open={r.round === rounds.length - 1}
            className="card overflow-hidden group"
          >
            <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-ink-50 transition-colors list-none">
              <h3 className="font-semibold tracking-tight">
                Runde {r.round + 1}
                <span className="ml-2 text-xs font-normal text-ink-500">
                  {r.matches.filter((m) => m.status === "finished").length}/
                  {r.matches.length}
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
                const finished = m.status === "finished";
                const bye = m.participantBId === null;
                return (
                  <li key={m.id} className="px-5 py-2.5">
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
                          T{m.tableNumber ?? "?"} {formatTime(m.scheduledAt)}
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
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
