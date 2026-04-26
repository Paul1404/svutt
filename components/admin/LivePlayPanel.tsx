"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, Participant } from "@/lib/db/schema";
import { Radio, X } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { matchNumber } from "@/lib/matchLabel";

type Props = {
  matches: Match[];
  participants: Participant[];
};

function stageLabel(m: Match): string {
  if (m.stage === "group") return "Gruppe";
  if (m.stage === "swiss") return `Runde ${m.round + 1}`;
  if (m.stage === "ko") return m.koLabel ?? "KO";
  if (m.stage === "ko_losers") return m.koLabel ?? "Trostrunde";
  return m.stage;
}

/**
 * Floating sidebar that lists every match currently flagged "Wird gespielt"
 * across the category. Shown as a fixed panel on the left of the admin UI on
 * wide screens; collapses to a small badge on smaller viewports so it never
 * fights with the main column for space. Lets the admin un-mark a match in
 * one click once the table is freed.
 */
export function LivePlayPanel({ matches, participants }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const partsById = new Map(participants.map((p) => [p.id, p]));
  const live = matches
    .filter((m) => m.played && m.status !== "finished")
    .sort((a, b) => (a.tableNumber ?? 999) - (b.tableNumber ?? 999));

  // Auto-collapse if there are no live matches; reopen as soon as one shows up
  // so the admin doesn't have to manually expand the panel mid-tournament.
  useEffect(() => {
    if (live.length === 0) setCollapsed(true);
    else setCollapsed(false);
  }, [live.length]);

  if (live.length === 0) return null;

  async function clearPlayed(matchId: string) {
    setBusyId(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}/played`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ played: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show({
          message:
            typeof data?.error === "string"
              ? data.error
              : "Markierung fehlgeschlagen.",
        });
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="live-panel-pill fixed left-3 top-24 z-30 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-soft transition-colors"
        title="Aktive Spiele anzeigen"
      >
        <span className="live-panel-pill-dot h-1.5 w-1.5 animate-pulse rounded-full" />
        {live.length} live
      </button>
    );
  }

  return (
    <aside
      aria-label="Aktive Spiele"
      className="fixed left-3 top-24 z-30 hidden xl:block w-64"
    >
      <div className="card live-panel-card overflow-hidden">
        <div className="live-panel-header flex items-center justify-between gap-2 px-3 py-2 border-b">
          <div className="flex items-center gap-1.5">
            <Radio size={14} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Wird gespielt
            </span>
            <span className="live-panel-header-meta text-xs font-mono tabular-nums">
              ({live.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="live-panel-header-meta hover:opacity-80 transition-opacity"
            title="Einklappen"
            aria-label="Aktive Spiele einklappen"
          >
            <X size={14} />
          </button>
        </div>
        <ul className="divide-y divide-ink-100 max-h-[60vh] overflow-y-auto">
          {live.map((m) => {
            const a = partsById.get(m.participantAId ?? "");
            const b = partsById.get(m.participantBId ?? "");
            const busy = busyId === m.id;
            return (
              <li key={m.id} className="px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-500">
                      {matchNumber(m) !== null && (
                        <>
                          <span className="live-panel-row-meta font-mono tabular-nums">
                            {matchNumber(m)}
                          </span>
                          <span className="text-ink-300">·</span>
                        </>
                      )}
                      <span className="live-panel-row-meta font-mono tabular-nums">
                        T{m.tableNumber ?? "?"}
                      </span>
                      <span className="text-ink-300">·</span>
                      <span>{stageLabel(m)}</span>
                    </div>
                    <div className="mt-0.5 truncate font-medium text-ink-900">
                      {a?.name ?? "?"}
                    </div>
                    <div className="truncate text-ink-500">gg.</div>
                    <div className="truncate font-medium text-ink-900">
                      {b?.name ?? "?"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => clearPlayed(m.id)}
                    disabled={busy}
                    className="live-panel-clear shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50 transition-colors"
                    title="Markierung „Wird gespielt“ entfernen"
                  >
                    {busy ? "…" : "Fertig"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
