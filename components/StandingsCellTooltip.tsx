"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const TOOLTIP_WIDTH = 256;
const TOOLTIP_GAP = 4;
const VIEWPORT_MARGIN = 8;

export function StandingsCellTooltip({
  value,
  metric,
  breakdowns,
  align = "right",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: Event) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function updatePosition() {
      const trigger = wrapRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      let left =
        align === "right"
          ? rect.right - TOOLTIP_WIDTH
          : rect.left;
      left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(left, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN),
      );
      const top = rect.bottom + TOOLTIP_GAP;
      setPos({ top, left });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, align]);

  const tooltip =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: TOOLTIP_WIDTH,
            }}
            className="z-50 rounded-lg border border-ink-200 bg-surface p-3 text-xs leading-relaxed text-ink-700 shadow-lift text-left"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <span ref={wrapRef} className="inline-block">
      <button
        type="button"
        aria-label={`${METRIC_LABELS[metric]} — Details anzeigen`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onFocus={(e) => {
          // Touch devices synthesize focus on tap — rely on onClick there so
          // tapping toggles instead of latching open.
          if (e.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          const next = (e.relatedTarget as Node) ?? document.activeElement;
          if (wrapRef.current?.contains(next)) return;
          if (tipRef.current?.contains(next)) return;
          setOpen(false);
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node;
          if (wrapRef.current?.contains(next)) return;
          if (tipRef.current?.contains(next)) return;
          setOpen(false);
        }}
        className="tabular-nums rounded px-0.5 underline decoration-dotted decoration-ink-300 underline-offset-[3px] hover:bg-ink-100 focus-visible:bg-ink-100 sm:cursor-help transition-colors"
      >
        {value}
      </button>
      {tooltip}
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
