"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";

type Props = {
  match: Match;
  sets: MatchSetRow[];
  playerA: Participant;
  playerB: Participant;
  onClose: () => void;
};

type EditSet = { a: string; b: string };

export function MatchResultDialog({
  match,
  sets,
  playerA,
  playerB,
  onClose,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const priorSets = sets;
  const initial: EditSet[] =
    sets.length > 0
      ? sets.map((s) => ({ a: String(s.pointsA), b: String(s.pointsB) }))
      : [
          { a: "", b: "" },
          { a: "", b: "" },
          { a: "", b: "" },
        ];
  const [rows, setRows] = useState<EditSet[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const first = dialogRef.current?.querySelector<HTMLInputElement>("input");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    const parsed = rows
      .filter((r) => r.a !== "" || r.b !== "")
      .map((r) => ({ a: parseInt(r.a, 10), b: parseInt(r.b, 10) }));
    if (parsed.some((s) => Number.isNaN(s.a) || Number.isNaN(s.b))) {
      setError("Bitte in jedem Satz beide Zahlen eintragen.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/matches/${match.id}/result`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sets: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Speichern hat nicht geklappt.");
        return;
      }
      toast.show({
        message: `Ergebnis gespeichert: ${playerA.name} gegen ${playerB.name}.`,
        undo: async () => {
          if (priorSets.length > 0) {
            await fetch(`/api/matches/${match.id}/result`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                sets: priorSets.map((s) => ({ a: s.pointsA, b: s.pointsB })),
              }),
            });
          } else {
            await fetch(`/api/matches/${match.id}/result`, {
              method: "DELETE",
            });
          }
          router.refresh();
        },
      });
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function clearResult() {
    const ok = await confirm({
      title: "Ergebnis löschen",
      message: "Das eingetragene Ergebnis wird entfernt. Das Spiel geht zurück auf ausstehend.",
      confirmLabel: "Löschen",
      variant: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await fetch(`/api/matches/${match.id}/result`, { method: "DELETE" });
      toast.show({
        message: "Ergebnis gelöscht.",
        undo:
          priorSets.length > 0
            ? async () => {
                await fetch(`/api/matches/${match.id}/result`, {
                  method: "PUT",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    sets: priorSets.map((s) => ({
                      a: s.pointsA,
                      b: s.pointsB,
                    })),
                  }),
                });
                router.refresh();
              }
            : undefined,
      });
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-result-heading"
        className="card w-full max-w-md shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-ink-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1">
            Ergebnis eintragen
          </div>
          <h3
            id="match-result-heading"
            className="text-lg font-semibold tracking-tight leading-snug"
          >
            {playerA.name}{" "}
            <span className="text-ink-400 font-normal">gegen</span>{" "}
            {playerB.name}
          </h3>
        </div>

        <div className="px-6 py-5 space-y-3">
          {match.forfeitedBy && (
            <div className="alert-amber">
              Dieses Spiel wurde durch Disqualifikation entschieden. Die
              Sätze unten sind ein Platzhalter. Beim Speichern wird das
              Ergebnis zu einem normalen Resultat.
            </div>
          )}
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-16 text-xs uppercase tracking-wider font-semibold text-ink-500">
                Satz {i + 1}
              </span>
              <input
                className="input w-20 text-center font-mono text-lg font-semibold"
                inputMode="numeric"
                placeholder="11"
                value={row.a}
                onChange={(e) =>
                  setRows((r) =>
                    r.map((x, j) =>
                      j === i
                        ? { ...x, a: e.target.value.replace(/\D/g, "") }
                        : x,
                    ),
                  )
                }
              />
              <span className="text-ink-300 font-bold">:</span>
              <input
                className="input w-20 text-center font-mono text-lg font-semibold"
                inputMode="numeric"
                placeholder="5"
                value={row.b}
                onChange={(e) =>
                  setRows((r) =>
                    r.map((x, j) =>
                      j === i
                        ? { ...x, b: e.target.value.replace(/\D/g, "") }
                        : x,
                    ),
                  )
                }
              />
            </div>
          ))}

          <div className="rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-600 leading-relaxed">
            Ein Satz geht auf 11 mit 2 Punkten Vorsprung. Leere Sätze werden
            übersprungen.
          </div>

          {error && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-ink-100 bg-ink-50/50 rounded-b-xl">
          <button
            type="button"
            onClick={clearResult}
            disabled={saving || match.status !== "finished"}
            className="text-xs font-medium text-ink-500 hover:text-brand-600 disabled:text-ink-300 disabled:hover:text-ink-300"
          >
            Ergebnis löschen
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
