"use client";

import { useState } from "react";
import type { Group, Match, Participant } from "@/lib/db/schema";
import { ChevronDown, Hourglass, Radio } from "@/components/Icon";
import { displayName } from "@/lib/displayName";

type Props = {
  matches: Match[];
  participants: Participant[];
  groups?: Group[];
};

const VISIBLE_UP_NEXT = 5;

/**
 * Spectator-facing call list. Same data as the admin {@link CallList} but
 * styled like a stadium scoreboard so it reads from across the room. The live
 * row gets a vivid hero card; the queue is a big numbered list.
 */
export function PublicCallList({ matches, participants, groups }: Props) {
  const [showAll, setShowAll] = useState(false);

  const partsById = new Map(participants.map((p) => [p.id, p]));
  const groupsById = new Map((groups ?? []).map((g) => [g.id, g]));

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

  const visibleQueue = showAll ? queue : queue.slice(0, VISIBLE_UP_NEXT);
  const hiddenCount = Math.max(0, queue.length - VISIBLE_UP_NEXT);

  return (
    <section
      className="relative overflow-hidden rounded-2xl ring-1 ring-ink-200/70 bg-gradient-to-br from-surface via-surface to-brand-50/40 shadow-pop"
      aria-label="Spielreihenfolge"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl"
      />

      <header className="relative px-6 py-5 border-b border-ink-100/80">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop ring-1 ring-inset ring-white/20">
              <Hourglass size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-700">
                Aufrufliste
              </div>
              <h2 className="mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
                Spielreihenfolge
              </h2>
              <p className="mt-1 text-sm text-ink-500 max-w-md">
                Wer wann an den Tisch geht. Augen auf den Tisch und Ohren auf
                den Aufruf.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CountPill
              label="offen"
              value={queue.length}
              tone="brand"
            />
            {live.length > 0 && <CountPill label="live" value={live.length} tone="amber" pulse />}
          </div>
        </div>
      </header>

      {live.length > 0 && (
        <div className="relative px-6 pt-5 pb-2 space-y-3">
          {live.map((m) => (
            <LiveHero
              key={m.id}
              match={m}
              partsById={partsById}
              groupsById={groupsById}
            />
          ))}
        </div>
      )}

      <div className="relative px-6 pt-5 pb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-700">
            {live.length > 0 ? "Als Nächstes" : "Reihenfolge"}
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-brand-300/70 via-ink-200/60 to-transparent" />
          {queue.length > 0 && (
            <span className="text-[10px] font-mono tabular-nums uppercase tracking-wider text-ink-400">
              {queue.length} offen
            </span>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-ink-200 bg-surface-2/40 px-4 py-6 text-center text-sm text-ink-500">
            Alle weiteren Spiele laufen oder sind abgeschlossen.
          </div>
        ) : (
          <>
            <ol className="mt-4 space-y-2">
              {visibleQueue.map((m, i) => (
                <QueueRow
                  key={m.id}
                  match={m}
                  index={i + 1}
                  partsById={partsById}
                  groupsById={groupsById}
                />
              ))}
            </ol>
            {hiddenCount > 0 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200/70 hover:bg-brand-100 transition-colors"
              >
                Alle {queue.length} anzeigen
                <ChevronDown size={12} />
              </button>
            )}
            {showAll && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-700 transition-colors"
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

function CountPill({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: number;
  tone: "brand" | "amber";
  pulse?: boolean;
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-100 text-amber-800 ring-amber-200"
      : "bg-brand-50 text-brand-700 ring-brand-200/80";
  return (
    <div
      className={`relative inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 ring-1 ring-inset ${cls}`}
    >
      {pulse && (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-amber-500/60 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-600" />
        </span>
      )}
      <span className="text-base font-bold tabular-nums leading-none">
        {value}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
        {label}
      </span>
    </div>
  );
}

function LiveHero({
  match,
  partsById,
  groupsById,
}: {
  match: Match;
  partsById: Map<string, Participant>;
  groupsById: Map<string, Group>;
}) {
  const a = partsById.get(match.participantAId ?? "");
  const b = partsById.get(match.participantBId ?? "");
  const group = match.groupId ? groupsById.get(match.groupId) : undefined;

  return (
    <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white shadow-pop ring-1 ring-inset ring-white/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.25),_transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
      />

      <div className="relative px-5 sm:px-7 py-5 sm:py-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] backdrop-blur-sm ring-1 ring-inset ring-white/30">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-white/80 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Jetzt am Tisch
          </span>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]">
            {typeof match.tableNumber === "number" && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-sm ring-1 ring-inset ring-white/25">
                Tisch {match.tableNumber}
              </span>
            )}
            {group && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-sm ring-1 ring-inset ring-white/25">
                Gruppe {group.label}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 sm:mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
          <PlayerName
            name={a ? displayName(a.name) : "?"}
            align="right"
          />
          <span className="select-none rounded-full bg-black/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.25em] backdrop-blur-sm ring-1 ring-inset ring-white/30">
            vs
          </span>
          <PlayerName
            name={b ? displayName(b.name) : "?"}
            align="left"
          />
        </div>

        {typeof match.playOrder === "number" && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-mono tabular-nums uppercase tracking-[0.22em] text-white/80">
            <Radio size={11} />
            Spiel #{match.playOrder + 1}
          </div>
        )}
      </div>
    </article>
  );
}

function PlayerName({
  name,
  align,
}: {
  name: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <div className="text-lg sm:text-2xl md:text-3xl font-black leading-tight tracking-tight drop-shadow-sm break-words">
        {name}
      </div>
    </div>
  );
}

function QueueRow({
  match,
  index,
  partsById,
  groupsById,
}: {
  match: Match;
  index: number;
  partsById: Map<string, Participant>;
  groupsById: Map<string, Group>;
}) {
  const a = partsById.get(match.participantAId ?? "");
  const b = partsById.get(match.participantBId ?? "");
  const group = match.groupId ? groupsById.get(match.groupId) : undefined;
  const isNext = index === 1;

  return (
    <li
      className={`group/row relative overflow-hidden rounded-xl ring-1 transition-all ${
        isNext
          ? "bg-gradient-to-r from-brand-50 via-brand-50/70 to-surface ring-brand-200 shadow-soft"
          : "bg-surface ring-ink-200/70 hover:ring-ink-300"
      }`}
    >
      {isNext && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-500 to-brand-700"
        />
      )}
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
        <span
          className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl text-base sm:text-lg font-black tabular-nums ${
            isNext
              ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop ring-1 ring-inset ring-white/20"
              : "bg-ink-100 text-ink-700"
          }`}
        >
          {index}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono tabular-nums uppercase tracking-wider text-ink-500">
            {typeof match.playOrder === "number" && (
              <span className="font-semibold text-ink-700">
                #{match.playOrder + 1}
              </span>
            )}
            {typeof match.tableNumber === "number" && (
              <>
                <span className="text-ink-300">·</span>
                <span
                  className={
                    isNext ? "font-bold text-brand-700" : "font-semibold text-brand-700"
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
          <div
            className={`mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${
              isNext ? "text-base sm:text-lg" : "text-sm sm:text-base"
            }`}
          >
            <span className="font-bold text-ink-900 truncate">
              {a ? displayName(a.name) : "?"}
            </span>
            <span className="text-ink-400 text-xs font-medium">gegen</span>
            <span className="font-bold text-ink-900 truncate">
              {b ? displayName(b.name) : "?"}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
