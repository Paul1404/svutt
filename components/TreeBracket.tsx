import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";
import { Trophy } from "@/components/Icon";

export type TreeBracketMatch = Match;

type Props = {
  matches: TreeBracketMatch[];
  sets: MatchSetRow[];
  participants: Participant[];
  onMatchClick?: (match: TreeBracketMatch) => void;
  highlightFinal?: boolean;
};

const CARD_WIDTH = 240;
const CARD_HEIGHT = 94;
const COLUMN_GAP = 56;
const ROW_GAP = 22;
const SLOT_H = CARD_HEIGHT + ROW_GAP;

/**
 * Real-tree single-elimination bracket. Matches are positioned absolutely so
 * each round is horizontally stacked and every winning pair lines up exactly
 * with the merged match in the next column. SVG connectors draw the "tree"
 * branches between them.
 */
export function TreeBracket({
  matches,
  sets,
  participants,
  onMatchClick,
  highlightFinal = false,
}: Props) {
  if (matches.length === 0) return null;

  const partsById = new Map(participants.map((p) => [p.id, p]));

  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const s of sets) {
    const arr = setsByMatch.get(s.matchId) ?? [];
    arr.push(s);
    setsByMatch.set(s.matchId, arr);
  }
  for (const arr of setsByMatch.values())
    arr.sort((a, b) => a.setNumber - b.setNumber);

  const byRound = new Map<number, TreeBracketMatch[]>();
  for (const m of matches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  const rounds: { round: number; matches: TreeBracketMatch[] }[] = [];
  for (const [round, ms] of byRound) {
    ms.sort((a, b) => a.matchIndex - b.matchIndex);
    rounds.push({ round, matches: ms });
  }
  rounds.sort((a, b) => a.round - b.round);

  const firstRound = rounds[0]!;
  const rowsInFirstRound = firstRound.matches.length;
  const totalHeight = rowsInFirstRound * SLOT_H;
  const totalWidth = rounds.length * CARD_WIDTH + (rounds.length - 1) * COLUMN_GAP;

  function centerY(round: number, matchIndex: number): number {
    // Only position if this round has a real entry; otherwise interpolate from
    // the first-round match positions (2 * matchIndex and 2 * matchIndex + 1
    // of the adjacent deeper round).
    return (matchIndex + 0.5) * (SLOT_H * 2 ** round);
  }

  function columnX(round: number): number {
    return round * (CARD_WIDTH + COLUMN_GAP);
  }

  return (
    <div
      className="tree-bracket relative mx-auto"
      style={{
        width: totalWidth,
        height: totalHeight,
        minWidth: totalWidth,
      }}
    >
      {/* Connector SVG in the background */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={totalWidth}
        height={totalHeight}
      >
        {rounds.slice(0, -1).map((r) =>
          r.matches.map((m) => {
            const nextMatchIndex = Math.floor(m.matchIndex / 2);
            const fromX = columnX(r.round) + CARD_WIDTH;
            const fromY = centerY(r.round, m.matchIndex);
            const toX = columnX(r.round + 1);
            const toY = centerY(r.round + 1, nextMatchIndex);
            const midX = fromX + COLUMN_GAP / 2;
            return (
              <path
                key={m.id}
                d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="text-ink-200"
              />
            );
          }),
        )}
      </svg>

      {/* Round labels */}
      {rounds.map((r) => {
        const label = r.matches[0]?.koLabel ?? `Runde ${r.round + 1}`;
        return (
          <div
            key={`label-${r.round}`}
            className="absolute text-[10px] font-semibold uppercase tracking-wider text-brand-600"
            style={{
              left: columnX(r.round),
              width: CARD_WIDTH,
              top: -22,
              textAlign: "center",
            }}
          >
            {label}
          </div>
        );
      })}

      {/* Match cards */}
      {rounds.map((r) =>
        r.matches.map((m) => {
          const a = partsById.get(m.participantAId ?? "");
          const b = partsById.get(m.participantBId ?? "");
          const matchSets = setsByMatch.get(m.id) ?? [];
          const done = m.status === "finished";
          const winnerA = m.winnerParticipantId === m.participantAId;
          const winnerB = m.winnerParticipantId === m.participantBId;
          const isFinaleWinner =
            highlightFinal &&
            done &&
            (m.koLabel ?? "").toLowerCase() === "finale" &&
            !!m.winnerParticipantId;
          const canClick =
            !!onMatchClick && !!m.participantAId && !!m.participantBId;
          const top = centerY(r.round, m.matchIndex) - CARD_HEIGHT / 2;
          const left = columnX(r.round);

          const className = [
            "absolute p-3",
            isFinaleWinner
              ? "card ring-2 ring-amber-400 bg-amber-50/70"
              : canClick
                ? "card-hover cursor-pointer"
                : "card",
          ].join(" ");

          const content = (
            <>
              {isFinaleWinner && (
                <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  <Trophy size={12} /> Sieger
                </div>
              )}
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
              <div className="mt-1.5 text-[10px] text-ink-500 font-mono tabular-nums">
                T{m.tableNumber ?? "?"}
                {matchSets.length > 0 && (
                  <>
                    {" · "}
                    {matchSets
                      .map((s) => `${s.pointsA}:${s.pointsB}`)
                      .join(", ")}
                  </>
                )}
              </div>
            </>
          );

          const style = {
            left,
            top,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          } as const;

          if (canClick) {
            return (
              <button
                key={m.id}
                type="button"
                className={`${className} block text-left`}
                style={style}
                onClick={() => onMatchClick?.(m)}
              >
                {content}
              </button>
            );
          }
          return (
            <div key={m.id} className={className} style={style}>
              {content}
            </div>
          );
        }),
      )}
    </div>
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
