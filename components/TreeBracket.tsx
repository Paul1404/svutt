"use client";

import { useEffect, useRef, useState } from "react";
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

type Dims = {
  cardWidth: number;
  cardHeight: number;
  columnGap: number;
  rowGap: number;
  fontSize: number;
  labelSize: number;
  padX: number;
};

const DESKTOP: Dims = {
  cardWidth: 240,
  cardHeight: 94,
  columnGap: 56,
  rowGap: 22,
  fontSize: 14,
  labelSize: 10,
  padX: 12,
};

const MOBILE: Dims = {
  cardWidth: 156,
  cardHeight: 78,
  columnGap: 22,
  rowGap: 14,
  fontSize: 12,
  labelSize: 9,
  padX: 8,
};

/**
 * Real-tree single-elimination bracket. Matches are positioned absolutely so
 * each round is horizontally stacked and every winning pair lines up exactly
 * with the merged match in the next column. SVG connectors draw the "tree"
 * branches between them. The whole tree shrinks + wraps tighter on phones.
 */
export function TreeBracket({
  matches,
  sets,
  participants,
  onMatchClick,
  highlightFinal = false,
}: Props) {
  const isMobile = useIsMobile();
  const dims = isMobile ? MOBILE : DESKTOP;
  const slotH = dims.cardHeight + dims.rowGap;

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

  // Track the largest matchIndex in round 0 — even with byes, matchIndex
  // reflects the original slot position, so we need that to size the layout.
  const firstRound = rounds[0]!;
  const maxFirstRoundIndex = firstRound.matches.reduce(
    (m, r) => Math.max(m, r.matchIndex),
    0,
  );
  const rowsInFirstRound = maxFirstRoundIndex + 1;
  const totalHeight = rowsInFirstRound * slotH;
  const totalWidth =
    rounds.length * dims.cardWidth +
    (rounds.length - 1) * dims.columnGap;

  const centerY = (round: number, matchIndex: number): number =>
    (matchIndex + 0.5) * (slotH * 2 ** round);

  const columnX = (round: number): number =>
    round * (dims.cardWidth + dims.columnGap);

  // Build a quick lookup of matchId → (round, matchIndex) so we can draw
  // connector lines from any child match, no matter what round it's in
  // (important: bye-advanced winners skip rounds, so the downstream match's
  // source may be in a far earlier round).
  const coords = new Map<string, { round: number; matchIndex: number }>();
  for (const r of rounds)
    for (const m of r.matches)
      coords.set(m.id, { round: r.round, matchIndex: m.matchIndex });

  return (
    <div
      className="tree-bracket relative mx-auto"
      style={{
        width: totalWidth,
        height: totalHeight,
        minWidth: totalWidth,
        fontSize: dims.fontSize,
      }}
    >
      {/* Connector SVG in the background */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={totalWidth}
        height={totalHeight}
      >
        {rounds.slice(1).flatMap((r) =>
          r.matches.flatMap((m) => {
            // Draw an L-path from each source match (via sourceMatch*Id)
            // into this match. Can't rely on matchIndex arithmetic alone
            // because bye-advanced winners come directly from earlier
            // rounds, potentially skipping a column.
            const toLeft = columnX(r.round);
            const toCenter = centerY(r.round, m.matchIndex);
            const midX = toLeft - dims.columnGap / 2;
            return [m.sourceMatchAId, m.sourceMatchBId]
              .map((srcId) => {
                if (!srcId) return null;
                const src = coords.get(srcId);
                if (!src) return null;
                const fromRight = columnX(src.round) + dims.cardWidth;
                const fromCenter = centerY(src.round, src.matchIndex);
                return (
                  <path
                    key={`${srcId}->${m.id}`}
                    d={`M ${fromRight} ${fromCenter} H ${midX} V ${toCenter} H ${toLeft}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.25}
                    className="text-ink-200"
                  />
                );
              })
              .filter(Boolean);
          }),
        )}
      </svg>

      {/* Round labels */}
      {rounds.map((r) => {
        const label = r.matches[0]?.koLabel ?? `Runde ${r.round + 1}`;
        return (
          <div
            key={`label-${r.round}`}
            className="absolute font-semibold uppercase tracking-wider text-brand-600"
            style={{
              left: columnX(r.round),
              width: dims.cardWidth,
              top: -22,
              textAlign: "center",
              fontSize: dims.labelSize,
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
          const top = centerY(r.round, m.matchIndex) - dims.cardHeight / 2;
          const left = columnX(r.round);

          const className = [
            "absolute",
            isFinaleWinner
              ? "card ring-2 ring-amber-400 bg-amber-50/70"
              : canClick
                ? "card-hover cursor-pointer"
                : "card",
          ].join(" ");

          const style = {
            left,
            top,
            width: dims.cardWidth,
            height: dims.cardHeight,
            padding: `${dims.padX - 2}px ${dims.padX}px`,
          } as const;

          const content = (
            <>
              {isFinaleWinner && (
                <div
                  className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-amber-700"
                  style={{ fontSize: dims.labelSize }}
                >
                  <Trophy size={12} /> Sieger
                </div>
              )}
              <Row
                name={a?.name ?? "…"}
                score={done ? m.setsA : null}
                winner={winnerA}
                placeholder={!a}
                compact={isMobile}
              />
              <div className="my-1 h-px bg-ink-100" />
              <Row
                name={b?.name ?? "…"}
                score={done ? m.setsB : null}
                winner={winnerB}
                placeholder={!b}
                compact={isMobile}
              />
              <div
                className="mt-1 text-ink-500 font-mono tabular-nums truncate"
                style={{ fontSize: dims.labelSize }}
              >
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
  compact,
}: {
  name: string;
  score: number | null;
  winner: boolean;
  placeholder: boolean;
  compact: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-0.5"
      style={{ fontSize: compact ? 12 : 14 }}
    >
      <span
        className={`truncate ${
          placeholder ? "italic text-ink-400" : winner ? "font-bold" : ""
        }`}
      >
        {name}
      </span>
      <span
        className={`pl-1.5 font-mono tabular-nums ${winner ? "font-bold text-brand-700" : "text-ink-500"}`}
        style={{ fontSize: compact ? 11 : 12 }}
      >
        {score !== null ? score : ""}
      </span>
    </div>
  );
}

function useIsMobile(): boolean {
  // Default to desktop on the server / first paint to keep SSR output
  // deterministic; the layout swaps to mobile after hydration on small
  // screens.
  const [isMobile, setIsMobile] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(mql.matches);
    apply();
    initialized.current = true;
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return isMobile;
}
