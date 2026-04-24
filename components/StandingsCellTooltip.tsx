"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MatchBreakdown } from "@/lib/engine/standings-breakdown";

type Metric = "wins" | "sets" | "points";

type Props = {
  value: React.ReactNode;
  metric: Metric;
  breakdowns: MatchBreakdown[];
  /** Align the popover to the right edge of the trigger (use on right-aligned cells). */
  align?: "left" | "right";
};

const METRIC_LABELS: Record<Metric, string> = {
  wins: "Siege",
  sets: "Satzdifferenz",
  points: "Punktdifferenz",
};

const METRIC_HINTS: Record<Metric, string> = {
  wins: "Anzahl gewonnener Spiele — Niederlagen.",
  sets: "Summe gewonnene Sätze minus verlorene Sätze.",
  points: "Summe gewonnene Ballpunkte minus verlorene Ballpunkte.",
};

/**
 * Inline standings cell with a hover/focus/tap tooltip that breaks the
 * aggregate number down into the finished matches that produced it.
 */
export function StandingsCellTooltip({
  value,
  metric,
  breakdowns,
  align = "right",
}: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        aria-label={`${METRIC_LABELS[metric]} — Details anzeigen`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onMouseLeave={(e) => {
          if (
            !wrapRef.current?.contains(
              (e.relatedTarget as Node) ?? document.activeElement,
            )
          ) {
            setOpen(false);
          }
        }}
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className="tabular-nums cursor-help rounded px-0.5 hover:bg-ink-100 focus-visible:bg-ink-100 transition-colors"
      >
        {value}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-full z-30 mt-1 w-64 rounded-lg border border-ink-200 bg-surface p-3 text-xs leading-relaxed text-ink-700 shadow-lift text-left ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="block font-semibold text-ink-900">
            {METRIC_LABELS[metric]}
          </span>
          <span className="block text-[11px] text-ink-500 mb-2">
            {METRIC_HINTS[metric]}
          </span>
          {breakdowns.length === 0 ? (
            <span className="block italic text-ink-500">
              Noch keine Spiele abgeschlossen.
            </span>
          ) : (
            <span className="block">
              <MetricBreakdown metric={metric} breakdowns={breakdowns} />
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function MetricBreakdown({
  metric,
  breakdowns,
}: {
  metric: Metric;
  breakdowns: MatchBreakdown[];
}) {
  let setTotal = 0;
  let pointTotal = 0;
  return (
    <span className="block space-y-1">
      {breakdowns.map((b) => {
        const setDiff = b.setsFor - b.setsAgainst;
        const pointDiff = b.pointsFor - b.pointsAgainst;
        setTotal += setDiff;
        pointTotal += pointDiff;
        return (
          <span
            key={b.matchId}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0 flex-1 truncate">
              vs <span className="font-medium">{b.opponentName}</span>
            </span>
            {metric === "wins" && (
              <span
                className={`font-mono tabular-nums ${
                  b.won ? "text-emerald-700" : "text-ink-500"
                }`}
              >
                {b.won ? "Sieg" : "Niederlage"}
              </span>
            )}
            {metric === "sets" && (
              <span className="font-mono tabular-nums text-ink-600">
                {b.setsFor}:{b.setsAgainst}{" "}
                <span className={setDiff >= 0 ? "text-emerald-700" : "text-brand-700"}>
                  ({setDiff >= 0 ? "+" : ""}
                  {setDiff})
                </span>
              </span>
            )}
            {metric === "points" && (
              <span className="font-mono tabular-nums text-ink-600">
                {b.pointsFor}:{b.pointsAgainst}{" "}
                <span className={pointDiff >= 0 ? "text-emerald-700" : "text-brand-700"}>
                  ({pointDiff >= 0 ? "+" : ""}
                  {pointDiff})
                </span>
              </span>
            )}
          </span>
        );
      })}
      {metric === "sets" && (
        <span className="flex items-center justify-between gap-2 pt-1 border-t border-ink-100 font-semibold">
          <span>Summe</span>
          <span
            className={`font-mono tabular-nums ${
              setTotal >= 0 ? "text-emerald-700" : "text-brand-700"
            }`}
          >
            {setTotal >= 0 ? "+" : ""}
            {setTotal}
          </span>
        </span>
      )}
      {metric === "points" && (
        <span className="flex items-center justify-between gap-2 pt-1 border-t border-ink-100 font-semibold">
          <span>Summe</span>
          <span
            className={`font-mono tabular-nums ${
              pointTotal >= 0 ? "text-emerald-700" : "text-brand-700"
            }`}
          >
            {pointTotal >= 0 ? "+" : ""}
            {pointTotal}
          </span>
        </span>
      )}
    </span>
  );
}
