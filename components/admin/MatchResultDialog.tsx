"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";

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

  async function save() {
    const parsed = rows
      .filter((r) => r.a !== "" || r.b !== "")
      .map((r) => ({ a: parseInt(r.a, 10), b: parseInt(r.b, 10) }));
    if (parsed.some((s) => Number.isNaN(s.a) || Number.isNaN(s.b))) {
      setError("Alle eingetragenen Sätze müssen Zahlen sein.");
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
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function clearResult() {
    if (!confirm("Ergebnis wirklich zurücksetzen?")) return;
    setSaving(true);
    try {
      await fetch(`/api/matches/${match.id}/result`, { method: "DELETE" });
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card p-5 max-w-md w-full space-y-4">
        <div>
          <h3 className="text-lg font-semibold">
            {playerA.name} vs {playerB.name}
          </h3>
          <p className="text-xs text-slate-500">Satzergebnisse eintragen</p>
        </div>

        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-14 text-sm text-slate-500">Satz {i + 1}</span>
              <input
                className="input w-20 text-center font-mono"
                inputMode="numeric"
                placeholder="11"
                value={row.a}
                onChange={(e) =>
                  setRows((r) =>
                    r.map((x, j) =>
                      j === i ? { ...x, a: e.target.value.replace(/\D/g, "") } : x,
                    ),
                  )
                }
              />
              <span>:</span>
              <input
                className="input w-20 text-center font-mono"
                inputMode="numeric"
                placeholder="5"
                value={row.b}
                onChange={(e) =>
                  setRows((r) =>
                    r.map((x, j) =>
                      j === i ? { ...x, b: e.target.value.replace(/\D/g, "") } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          Best of 3 — 2 oder 3 Sätze eintragen. Leere Zeilen werden ignoriert.
          Gültige Sätze: 11:x (x ≤ 9) oder Einstand +2 (z.B. 12:10).
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={clearResult}
            disabled={saving || match.status !== "finished"}
            className="text-xs text-red-600 hover:underline disabled:text-slate-400"
          >
            Ergebnis zurücksetzen
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
              {saving ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
