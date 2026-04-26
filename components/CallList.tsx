"use client";

import { useState } from "react";
import type { Group, Match, Participant } from "@/lib/db/schema";
import { Radio, ChevronDown, Hourglass } from "@/components/Icon";
import { displayName } from "@/lib/displayName";

type Props = {
  matches: Match[];
  participants: Participant[];
  groups?: Group[];
  /**
   * Callback for the inline "Aufrufen" button. When omitted, the list is
   * read-only (public mode). The admin panel passes its own implementation
   * that talks to /api/matches/:id/played and refreshes via next/router.
   */
  onMarkLive?: (matchId: string, next: boolean) => Promise<void> | void;
  /**
   * When provided, the live row shows a primary "Ergebnis" button that opens
   * the result-entry dialog for the match. Saving the result finishes the
   * match, which removes it from the call list automatically.
   */
  onEnterResult?: (matchId: string) => void;
  /**
   * When provided, the live row exposes a "DQ" action that opens the
   * disqualify dialog for the running match.
   */
  onDisqualify?: (matchId: string) => void;
};

const VISIBLE_UP_NEXT = 4;

/**
 * "Spielreihenfolge" — a clean, ordered call list of upcoming group matches
 * sorted by the engine's smart play-order. Splits into:
 *   - currently being played (highlighted at top)
 *   - the next handful to call
 *   - the rest (collapsed by default)
 *
 * Pure UI: every match the user sees is one the scheduler already shaped to
 * keep the same player off two consecutive slots. The component just makes
 * that order visible and easy to read out loud.
 */
export function CallList({
  matches,
  participants,
  groups,
  onMarkLive,
  onEnterResult,
  onDisqualify,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const partsById = new Map(participants.map((p) => [p.id, p]));
  const groupsById = new Map((groups ?? []).map((g) => [g.id, g]));

  // Only group matches with two real players that aren't finished yet —
  // walkovers are skipped for the call sheet.
  const open = matches
    .filter(
      (m) =>
        m.stage === "group" &&
        m.participantAId !== null &&
        m.participantBId !== null &&
        m.status !== "finished",
    )
    .slice()
    .sort((a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0));

  const live = open.filter((m) => m.played);
  const queue = open.filter((m) => !m.played);

  if (open.length === 0) return null;

  const adminMode = typeof onMarkLive === "function";

  async function markLive(matchId: string, next: boolean) {
    if (!onMarkLive) return;
    setBusyId(matchId);
    try {
      await onMarkLive(matchId, next);
    } finally {
      setBusyId(null);
    }
  }

  const visibleQueue = showAll ? queue : queue.slice(0, VISIBLE_UP_NEXT);
  const hiddenCount = Math.max(0, queue.length - VISIBLE_UP_NEXT);

  return (
    <section className="card overflow-hidden" aria-label="Spielreihenfolge">
      <header className="px-5 py-4 border-b border-ink-100 bg-gradient-to-br from-brand-50/70 to-transparent">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
              <Hourglass size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">
                Aufrufliste
              </div>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-ink-900">
                Spielreihenfolge
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">
                In dieser Reihenfolge ausrufen. Der Plan vermeidet, dass
                jemand zwei Spiele in Folge an den Tisch muss.
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-ink-500 tabular-nums shrink-0">
            <div>
              <span className="font-semibold text-ink-900">{queue.length}</span>{" "}
              <span className="text-ink-400">offen</span>
            </div>
            {live.length > 0 && (
              <div className="mt-0.5 text-amber-700">
                <span className="font-semibold">{live.length}</span> am Tisch
              </div>
            )}
          </div>
        </div>
      </header>

      {live.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <SectionLabel
            tone="amber"
            icon={<Radio size={11} />}
            label="Jetzt am Tisch"
          />
          <ul className="mt-2 space-y-1.5">
            {live.map((m) => (
              <CallRow
                key={m.id}
                match={m}
                index={null}
                live
                partsById={partsById}
                groupsById={groupsById}
                adminMode={adminMode}
                busy={busyId === m.id}
                onClear={() => markLive(m.id, false)}
                onEnterResult={
                  onEnterResult ? () => onEnterResult(m.id) : undefined
                }
                onDisqualify={
                  onDisqualify ? () => onDisqualify(m.id) : undefined
                }
              />
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 pt-4 pb-4">
        <SectionLabel
          tone="brand"
          label={live.length > 0 ? "Als Nächstes" : "Reihenfolge"}
          rightSlot={
            queue.length > 0 ? (
              <span className="text-[10px] font-mono tabular-nums uppercase tracking-wider text-ink-400">
                {queue.length} offen
              </span>
            ) : null
          }
        />
        {queue.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-ink-200 bg-surface-2/40 px-3 py-4 text-center text-xs text-ink-500">
            Alle weiteren Spiele laufen oder sind abgeschlossen.
          </div>
        ) : (
          <>
            <ul className="mt-2 space-y-1.5">
              {visibleQueue.map((m, i) => (
                <CallRow
                  key={m.id}
                  match={m}
                  index={i + 1}
                  live={false}
                  partsById={partsById}
                  groupsById={groupsById}
                  adminMode={adminMode}
                  busy={busyId === m.id}
                  onMarkLive={() => markLive(m.id, true)}
                />
              ))}
            </ul>
            {hiddenCount > 0 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
              >
                Alle {queue.length} anzeigen
                <ChevronDown size={12} />
              </button>
            )}
            {showAll && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-700 transition-colors"
              >
                Liste einklappen
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function SectionLabel({
  tone,
  icon,
  label,
  rightSlot,
}: {
  tone: "amber" | "brand" | "ink";
  icon?: React.ReactNode;
  label: string;
  rightSlot?: React.ReactNode;
}) {
  const cls =
    tone === "amber"
      ? "text-amber-700"
      : tone === "brand"
        ? "text-brand-700"
        : "text-ink-500";
  const ruleCls =
    tone === "amber"
      ? "from-amber-300/70"
      : tone === "brand"
        ? "from-brand-300/70"
        : "from-ink-200";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] ${cls}`}
      >
        {icon}
        {label}
      </span>
      <span
        className={`h-px flex-1 bg-gradient-to-r ${ruleCls} via-ink-200/60 to-transparent`}
      />
      {rightSlot}
    </div>
  );
}

function CallRow({
  match,
  index,
  live,
  partsById,
  groupsById,
  adminMode,
  busy,
  onMarkLive,
  onClear,
  onEnterResult,
  onDisqualify,
}: {
  match: Match;
  index: number | null;
  live: boolean;
  partsById: Map<string, Participant>;
  groupsById: Map<string, Group>;
  adminMode: boolean;
  busy: boolean;
  onMarkLive?: () => void;
  onClear?: () => void;
  onEnterResult?: () => void;
  onDisqualify?: () => void;
}) {
  const a = partsById.get(match.participantAId ?? "");
  const b = partsById.get(match.participantBId ?? "");
  const group = match.groupId ? groupsById.get(match.groupId) : undefined;

  // Visual rhythm:
  //   - live row → amber tint, pulsing dot, "Fertig" button when adminMode
  //   - up-next row → brand-tinted ordinal pill, mono game number, optional
  //     "Aufrufen" button that flips the match to live
  return (
    <li
      className={`group/row rounded-lg ring-1 transition-colors ${
        live
          ? "call-row-live"
          : index === 1
            ? "bg-brand-50/40 ring-brand-200/70"
            : "bg-surface ring-ink-200/70 hover:ring-ink-300"
      }`}
    >
      <div className="flex items-stretch gap-3 px-3 py-2.5">
        <div className="flex flex-col items-center justify-center w-9 shrink-0">
          {live ? (
            <span className="call-row-live-icon relative inline-flex h-7 w-7 items-center justify-center rounded-full">
              <span className="call-row-live-icon-pulse absolute inset-0 rounded-full animate-ping" />
              <Radio size={12} />
            </span>
          ) : (
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                index === 1
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-700"
              }`}
            >
              {index}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono tabular-nums uppercase tracking-wider text-ink-500">
            {typeof match.playOrder === "number" && (
              <span
                className={`font-semibold ${
                  live ? "call-row-live-meta" : "text-ink-700"
                }`}
              >
                #{match.playOrder + 1}
              </span>
            )}
            {typeof match.tableNumber === "number" && (
              <>
                <span className="text-ink-300">·</span>
                <span
                  className={
                    live ? "call-row-live-table" : "font-semibold text-brand-700"
                  }
                >
                  Tisch {match.tableNumber}
                </span>
              </>
            )}
            {group && (
              <>
                <span className="text-ink-300">·</span>
                <span className="text-ink-500">Gruppe {group.label}</span>
              </>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span
              className={`font-semibold truncate ${
                live ? "call-row-live-name" : "text-ink-900"
              }`}
            >
              {a ? displayName(a.name) : "?"}
            </span>
            <span className="text-ink-400 text-xs">gegen</span>
            <span
              className={`font-semibold truncate ${
                live ? "call-row-live-name" : "text-ink-900"
              }`}
            >
              {b ? displayName(b.name) : "?"}
            </span>
          </div>
        </div>

        {adminMode && live && (onEnterResult || onClear || onDisqualify) && (
          <div className="self-center shrink-0 flex items-center gap-1.5">
            {onEnterResult && (
              <button
                type="button"
                onClick={onEnterResult}
                disabled={busy}
                className="call-row-live-result rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-soft disabled:opacity-50 transition-colors"
                title="Spiel ist fertig. Ergebnis eintragen."
              >
                Ergebnis
              </button>
            )}
            {onDisqualify && (
              <button
                type="button"
                onClick={onDisqualify}
                disabled={busy}
                className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-inset ring-brand-200 bg-surface hover:bg-brand-50 disabled:opacity-50 transition-colors"
                title="Einen Spieler disqualifizieren. Der andere gewinnt automatisch."
              >
                DQ
              </button>
            )}
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={busy}
                className="call-row-live-cancel rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-50 transition-colors"
                title="Markierung „Wird gespielt“ entfernen, ohne Ergebnis einzutragen"
              >
                {busy ? "…" : "Abbrechen"}
              </button>
            )}
          </div>
        )}
        {adminMode && !live && onMarkLive && (
          <button
            type="button"
            onClick={onMarkLive}
            disabled={busy}
            className="self-center shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            title="Spieler aufgerufen. Spiel beginnt."
          >
            {busy ? "…" : "Aufrufen"}
          </button>
        )}
      </div>
    </li>
  );
}
