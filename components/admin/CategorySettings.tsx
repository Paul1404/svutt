"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "@/lib/db/schema";
import { AlertTriangle, Settings, Trash } from "@/components/Icon";

export function CategorySettings({
  category,
  tournamentId,
}: {
  category: Category;
  tournamentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [groupSize, setGroupSize] = useState(category.groupSize);
  const [winSets, setWinSets] = useState(category.winSets);
  const [setPoints, setSetPoints] = useState(category.setPoints);
  const [setMinLead, setSetMinLead] = useState(category.setMinLead);
  const [luckyLoserEnabled, setLuckyLoserEnabled] = useState(
    category.luckyLoserEnabled,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);

  const drawn = category.drawDone;
  const deleteMatches = deleteTyped.trim() === category.slug;

  if (!open) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat label="Gruppen à" value={String(category.groupSize)} />
            <Stat label="Modus" value={`Best of ${category.winSets * 2 - 1}`} />
            <Stat
              label="Sätze"
              value={`${category.setPoints} Pkt, +${category.setMinLead}`}
            />
            <Stat
              label="Lucky Loser"
              value={category.luckyLoserEnabled ? "an" : "aus"}
            />
          </div>
          <button
            className="btn-secondary btn-sm inline-flex items-center gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Settings size={14} /> Anpassen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="card p-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaving(true);
          try {
            const res = await fetch(`/api/categories/${category.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                ...(drawn
                  ? {}
                  : {
                      groupSize,
                      winSets,
                    }),
                setPoints,
                setMinLead,
                luckyLoserEnabled,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "Speichern hat nicht geklappt.");
              return;
            }
            setOpen(false);
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
      >
        <h3 className="font-semibold tracking-tight">Spielklasse anpassen</h3>
        {drawn && (
          <p className="text-xs text-ink-500">
            Gruppen sind bereits gezogen — Gruppengröße und Spielmodus lassen
            sich nicht mehr ändern.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Spieler pro Gruppe</label>
            <input
              className="input"
              type="number"
              min={4}
              max={8}
              value={groupSize}
              disabled={drawn}
              onChange={(e) => setGroupSize(parseInt(e.target.value, 10))}
            />
          </div>
          <div>
            <label className="label">Spielmodus</label>
            <select
              className="input"
              value={winSets}
              disabled={drawn}
              onChange={(e) => setWinSets(parseInt(e.target.value, 10))}
            >
              <option value={2}>Best of 3</option>
              <option value={3}>Best of 5</option>
              <option value={4}>Best of 7</option>
            </select>
          </div>
          <div>
            <label className="label">Satz-Punkte</label>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={setPoints}
              onChange={(e) => setSetPoints(parseInt(e.target.value, 10))}
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Standard: 11.
            </p>
          </div>
          <div>
            <label className="label">Mindestvorsprung</label>
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              value={setMinLead}
              onChange={(e) => setSetMinLead(parseInt(e.target.value, 10))}
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Standard: 2 (Einstand).
            </p>
          </div>
          <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer rounded-lg border border-ink-200 bg-white p-3 hover:border-brand-300 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={luckyLoserEnabled}
              onChange={(e) => setLuckyLoserEnabled(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Lucky Loser zulassen</span>
              <span className="block text-xs text-ink-500 mt-0.5">
                Bessere Gruppendritte rücken nach, wenn die Gruppenanzahl keine
                Zweierpotenz ist. Wenn aus: leere Plätze (Freilos).
              </span>
            </span>
          </label>
        </div>
        {error && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Abbrechen
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5">
        <div className="flex items-start gap-3">
          <span className="text-brand-600 mt-0.5">
            <AlertTriangle size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold tracking-tight text-brand-900">
              Spielklasse löschen
            </h3>
            <p className="mt-1 text-sm text-brand-800">
              Entfernt diese Spielklasse mit allen Teilnehmern, Gruppen und
              Spielen. Das Turnier selbst bleibt bestehen.
            </p>

            {!confirmingDelete ? (
              <button
                type="button"
                className="mt-4 btn-danger btn-sm inline-flex items-center gap-1.5"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash size={14} /> Spielklasse löschen
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-brand-900">
                  Tippe das Kürzel{" "}
                  <code className="kbd">{category.slug}</code> ein, um zu
                  bestätigen.
                </label>
                <input
                  className="input font-mono"
                  value={deleteTyped}
                  onChange={(e) => setDeleteTyped(e.target.value)}
                  autoFocus
                  placeholder={category.slug}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeleteTyped("");
                    }}
                    disabled={busyDelete}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm inline-flex items-center gap-1.5"
                    disabled={!deleteMatches || busyDelete}
                    onClick={async () => {
                      setBusyDelete(true);
                      try {
                        const res = await fetch(
                          `/api/categories/${category.id}`,
                          { method: "DELETE" },
                        );
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          setError(data.error ?? "Löschen hat nicht geklappt.");
                          return;
                        }
                        router.push(`/admin/t/${tournamentId}`);
                        router.refresh();
                      } finally {
                        setBusyDelete(false);
                      }
                    }}
                  >
                    <Trash size={14} />
                    {busyDelete ? "Lösche..." : "Endgültig löschen"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
