"use client";

import { useEffect, useRef, useState } from "react";
import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";
import { Trophy } from "@/components/Icon";
import { displayName } from "@/lib/displayName";

export type TreeBracketMatch = Match;

/**
 * Origin of a player in the KO bracket: which group they came from, at what
 * rank, and the standings stats that earned the seeding. Used for the small
 * caption under each name so viewers see at a glance why a player is there -
 * not just "because they advanced" but "won Gruppe A with 3-1, +22".
 */
export type BracketOrigin = {
  groupLabel: string;
  groupRank: number;
  wins: number;
  losses: number;
  setDiff: number;
  pointDiff: number;
};

type Props = {
  matches: TreeBracketMatch[];
  sets: MatchSetRow[];
  participants: Participant[];
  /**
   * Optional map from participantId → origin (group + rank). When provided,
   * each round-0 card shows a small caption under the player name so viewers
   * can see why someone advanced (e.g. "1. Gruppe A").
   */
  origins?: Map<string, BracketOrigin>;
  onMatchClick?: (match: TreeBracketMatch) => void;
  /**
   * Optional admin-only handler to flip the "currently being played" marker
   * on a bracket match. When provided, each pending card with both players
   * known shows a small toggle button.
   */
  onTogglePlayed?: (match: TreeBracketMatch, next: boolean) => void;
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
  cardWidth: 248,
  cardHeight: 140,
  columnGap: 56,
  rowGap: 22,
  fontSize: 14,
  labelSize: 10,
  padX: 12,
};

const MOBILE: Dims = {
  cardWidth: 168,
  cardHeight: 118,
  columnGap: 22,
  rowGap: 14,
  fontSize: 12,
  labelSize: 9,
  padX: 8,
};

function formatOrigin(o: BracketOrigin): string {
  // "1. Gruppe A · 3-1 · +22" - group rank + wins/losses + point diff. The
  // point diff is the actual tiebreaker that decided the seeding, so showing
  // it makes the bracket placement transparent. Set diff is omitted to keep
  // the line short enough to fit a mobile card without truncation.
  const pd = o.pointDiff > 0 ? `+${o.pointDiff}` : `${o.pointDiff}`;
  return `${o.groupRank}. Gruppe ${o.groupLabel} · ${o.wins}-${o.losses} · ${pd}`;
}

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
  origins,
  onMatchClick,
  onTogglePlayed,
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

  // Layout y-centers are computed bottom-up so every parent card sits at the
  // exact midpoint of its real source matches. This keeps connector lines
  // aligned with card edges even when the tree is irregular (byes skipping
  // rounds, lucky-loser pools that don't pack into a clean 2^n).
  const matchRound = new Map<string, number>();
  for (const r of rounds)
    for (const m of r.matches) matchRound.set(m.id, r.round);

  const matchY = new Map<string, number>();
  for (const r of rounds) {
    for (const m of r.matches) {
      if (r.round === 0) {
        matchY.set(m.id, (m.matchIndex + 0.5) * slotH);
        continue;
      }
      const srcYs = [m.sourceMatchAId, m.sourceMatchBId]
        .map((id) => (id ? matchY.get(id) : undefined))
        .filter((y): y is number => typeof y === "number");
      if (srcYs.length > 0) {
        matchY.set(
          m.id,
          srcYs.reduce((a, b) => a + b, 0) / srcYs.length,
        );
      } else {
        // No known upstream matches: fall back to the formula so the card
        // still lands somewhere sensible.
        matchY.set(
          m.id,
          (m.matchIndex + 0.5) * slotH * 2 ** r.round,
        );
      }
    }
  }

  const centerY = (matchId: string, fallbackRound = 0, fallbackIndex = 0): number =>
    matchY.get(matchId) ??
    (fallbackIndex + 0.5) * slotH * 2 ** fallbackRound;

  const columnX = (round: number): number =>
    round * (dims.cardWidth + dims.columnGap);

  const hasFinaleWinner =
    highlightFinal &&
    matches.some(
      (m) =>
        m.status === "finished" &&
        (m.koLabel ?? "").toLowerCase() === "finale" &&
        !!m.winnerParticipantId,
    );
  let maxY = 0;
  for (const y of matchY.values()) if (y > maxY) maxY = y;
  const totalHeight =
    maxY + dims.cardHeight / 2 + dims.rowGap + (hasFinaleWinner ? 26 : 0);
  const totalWidth =
    rounds.length * dims.cardWidth +
    (rounds.length - 1) * dims.columnGap;

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
            // L-path from each source match's right edge to this match's left
            // edge. Source y-centers and target y-center come from the same
            // matchY lookup so lines always land on card edges.
            const toLeft = columnX(r.round);
            const toCenter = centerY(m.id, r.round, m.matchIndex);
            const midX = toLeft - dims.columnGap / 2;
            return [m.sourceMatchAId, m.sourceMatchBId]
              .map((srcId) => {
                if (!srcId) return null;
                const srcRound = matchRound.get(srcId);
                if (srcRound === undefined) return null;
                const fromRight = columnX(srcRound) + dims.cardWidth;
                const fromCenter = centerY(srcId, srcRound);
                return (
                  <path
                    key={`${srcId}->${m.id}`}
                    d={`M ${fromRight} ${fromCenter} H ${midX} V ${toCenter} H ${toLeft}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.25}
                    className="text-ink-300"
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
          // A bye is a finished match where one side was never filled: the
          // lone participant auto-advances, so hide the phantom 0:0 score.
          const isBye =
            done && (!m.participantAId || !m.participantBId);
          const winnerA = m.winnerParticipantId === m.participantAId;
          const winnerB = m.winnerParticipantId === m.participantBId;
          const isFinaleWinner =
            highlightFinal &&
            done &&
            (m.koLabel ?? "").toLowerCase() === "finale" &&
            !!m.winnerParticipantId;
          const inProgress = !!m.played && !done;
          const canClick =
            !!onMatchClick && !!m.participantAId && !!m.participantBId;
          const canToggle =
            !!onTogglePlayed &&
            !done &&
            !!m.participantAId &&
            !!m.participantBId;
          // The finale winner card renders an extra "Sieger" header, so it
          // needs more height than the standard fixed cardHeight. Keep the
          // vertical center aligned with its siblings so bracket lines still
          // land correctly.
          const finaleExtra = isFinaleWinner ? 26 : 0;
          const cardH = dims.cardHeight + finaleExtra;
          const top = centerY(m.id, r.round, m.matchIndex) - cardH / 2;
          const left = columnX(r.round);

          // Card visual states (mutually exclusive, in priority order):
          //   1. Finale winner: gold treatment, kept as hardcoded amber so
          //      the trophy framing matches the rest of the tournament UI.
          //   2. In progress (admin flagged "wird gespielt"): amber tint via
          //      the dark-mode-aware .bracket-card-live class.
          //   3. Finished (non-finale): subtle emerald tint so admins can see
          //      at a glance which slots are still pending.
          const stateClass = isFinaleWinner
            ? "ring-2 ring-amber-400 bg-amber-50/70 overflow-hidden"
            : inProgress
              ? "bracket-card-live"
              : done && !isBye
                ? "bracket-card-done"
                : "";
          const className = [
            "absolute",
            canClick ? "card-hover cursor-pointer" : "card",
            stateClass,
          ]
            .filter(Boolean)
            .join(" ");

          const style = {
            left,
            top,
            width: dims.cardWidth,
            height: cardH,
            padding: `${dims.padX - 2}px ${dims.padX}px`,
          } as const;

          // Show origins only on the first round - after that the story
          // is "winner of the previous card" and an origin line would clutter.
          const showOrigins = r.round === 0 && !!origins;
          const originA = showOrigins && a ? origins.get(a.id) : undefined;
          const originB = showOrigins && b ? origins.get(b.id) : undefined;
          // The "advancing side" in a bye: the player whose opponent is an
          // empty slot. The origin caption still shows their group + stats so
          // the seed is transparent; "kampflos weiter" is added as a smaller
          // sub-caption so the advance is immediately visible.
          const byeAdvancesA = isBye && !!a && !b;
          const byeAdvancesB = isBye && !!b && !a;

          const captionA = a
            ? originA
              ? formatOrigin(originA)
              : null
            : isBye
              ? "kein:e Gegner:in"
              : null;
          const captionB = b
            ? originB
              ? formatOrigin(originB)
              : null
            : isBye
              ? "kein:e Gegner:in"
              : null;
          const subCaptionA = byeAdvancesA ? "kampflos weiter" : null;
          const subCaptionB = byeAdvancesB ? "kampflos weiter" : null;

          const inner = (
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
                name={a ? displayName(a.name) : isBye ? "Freilos" : "…"}
                caption={captionA}
                subCaption={subCaptionA}
                score={done && !isBye ? m.setsA : null}
                winner={winnerA}
                placeholder={!a}
                compact={isMobile}
                labelSize={dims.labelSize}
              />
              <div className="my-1 h-px bg-ink-100" />
              <Row
                name={b ? displayName(b.name) : isBye ? "Freilos" : "…"}
                caption={captionB}
                subCaption={subCaptionB}
                score={done && !isBye ? m.setsB : null}
                winner={winnerB}
                placeholder={!b}
                compact={isMobile}
                labelSize={dims.labelSize}
              />
              <div
                className="mt-1 flex items-center gap-1 font-mono tabular-nums truncate text-ink-500"
                style={{ fontSize: dims.labelSize }}
              >
                {inProgress && !isFinaleWinner && (
                  <span
                    className="bracket-pill-live inline-flex items-center gap-1 rounded px-1 py-px font-semibold uppercase tracking-wider"
                    style={{ fontSize: Math.max(dims.labelSize - 1, 8) }}
                  >
                    <span
                      className="bracket-pill-live-dot h-1 w-1 animate-pulse rounded-full"
                      aria-hidden
                    />
                    Live
                  </span>
                )}
                {done && !isBye && !isFinaleWinner && (
                  <span
                    className="bracket-pill-done inline-flex items-center gap-1 rounded px-1 py-px font-semibold uppercase tracking-wider"
                    style={{ fontSize: Math.max(dims.labelSize - 1, 8) }}
                  >
                    Beendet
                  </span>
                )}
                <span className="truncate">
                  T{m.tableNumber ?? "?"}
                  {matchSets.length > 0 && (
                    <>
                      {" · "}
                      {matchSets
                        .map((s) => `${s.pointsA}:${s.pointsB}`)
                        .join(", ")}
                    </>
                  )}
                </span>
              </div>
            </>
          );

          // Toggle sits in the top-right corner. We use stopPropagation so
          // clicking it doesn't also fire the card's open-result handler.
          const toggleButton = canToggle ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlayed?.(m, !m.played);
              }}
              aria-pressed={!!m.played}
              title={
                m.played
                  ? "Markierung „Wird gespielt“ entfernen"
                  : "Als „Wird gespielt“ markieren"
              }
              className={`absolute right-1.5 top-1.5 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                m.played
                  ? "bg-amber-200 text-amber-800 hover:bg-amber-300"
                  : "bg-ink-50 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              }`}
            >
              ✓
            </button>
          ) : null;

          // Use role="button" on a div instead of a real <button> when the
          // card needs both a click target and an inner toggle button -
          // nested <button>s aren't valid HTML. The card is already
          // position:absolute, which establishes a containing block for the
          // absolutely-positioned toggle button - no need for an extra
          // `relative` class (which would override `absolute` since Tailwind
          // emits .relative after .absolute).
          if (canClick) {
            return (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                className={`${className} text-left`}
                style={style}
                onClick={() => onMatchClick?.(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onMatchClick?.(m);
                  }
                }}
              >
                {inner}
                {toggleButton}
              </div>
            );
          }
          return (
            <div key={m.id} className={className} style={style}>
              {inner}
              {toggleButton}
            </div>
          );
        }),
      )}
    </div>
  );
}

function Row({
  name,
  caption,
  subCaption,
  score,
  winner,
  placeholder,
  compact,
  labelSize,
}: {
  name: string;
  caption: string | null;
  subCaption?: string | null;
  score: number | null;
  winner: boolean;
  placeholder: boolean;
  compact: boolean;
  labelSize: number;
}) {
  return (
    <div
      className="flex items-start justify-between py-0.5"
      style={{ fontSize: compact ? 12 : 14 }}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`truncate ${
            placeholder ? "italic text-ink-400" : winner ? "font-bold" : ""
          }`}
        >
          {name}
        </div>
        {caption && (
          <div
            className="truncate text-ink-400 italic"
            style={{ fontSize: labelSize }}
          >
            {caption}
          </div>
        )}
        {subCaption && (
          <div
            className="truncate text-brand-600/80 italic"
            style={{ fontSize: labelSize }}
          >
            {subCaption}
          </div>
        )}
      </div>
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
