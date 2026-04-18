"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Tournament } from "@/lib/db/schema";
import { AlertTriangle, Settings, Trash } from "@/components/Icon";

export function TournamentSettings({ tournament }: { tournament: Tournament }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tournament.name);
  const [location, setLocation] = useState(tournament.location ?? "");
  const [startTime, setStartTime] = useState(tournament.startTime);
  const [parallelTables, setParallelTables] = useState(
    tournament.parallelTables,
  );
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(
    tournament.matchDurationMinutes,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!open) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-6 flex-wrap text-sm">
            <Stat label="Start" value={`${tournament.startTime} Uhr`} />
            <Stat
              label="Tische"
              value={String(tournament.parallelTables)}
            />
            <Stat
              label="Spieldauer"
              value={`${tournament.matchDurationMinutes} Min`}
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
            const res = await fetch(`/api/tournaments/${tournament.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                location: location || "",
                startTime,
                parallelTables,
                matchDurationMinutes,
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
        <h3 className="font-semibold tracking-tight">Turnier anpassen</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Turniername</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Ort</label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z.B. Sporthalle Untereuerheim"
            />
          </div>
          <div>
            <label className="label">Startzeit</label>
            <input
              className="input"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Erstes Spiel des Tages.
            </p>
          </div>
          <div>
            <label className="label">Tische gleichzeitig</label>
            <input
              className="input"
              type="number"
              min={1}
              max={32}
              value={parallelTables}
              onChange={(e) => setParallelTables(parseInt(e.target.value, 10))}
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Wieviele Spiele laufen parallel.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Spieldauer (Minuten)</label>
            <input
              className="input"
              type="number"
              min={1}
              max={120}
              value={matchDurationMinutes}
              onChange={(e) =>
                setMatchDurationMinutes(parseInt(e.target.value, 10))
              }
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Faustregel inkl. Pause: 11 Min für Best of 3, 18 Min für Best of 5.
            </p>
          </div>
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

      <DangerZone
        slug={tournament.slug}
        confirmingDelete={confirmingDelete}
        setConfirmingDelete={setConfirmingDelete}
        onDelete={async () => {
          const res = await fetch(`/api/tournaments/${tournament.id}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data.error ?? "Löschen hat nicht geklappt.");
            return;
          }
          router.push("/admin");
          router.refresh();
        }}
      />
    </div>
  );
}

function DangerZone({
  slug,
  confirmingDelete,
  setConfirmingDelete,
  onDelete,
}: {
  slug: string;
  confirmingDelete: boolean;
  setConfirmingDelete: (v: boolean) => void;
  onDelete: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === slug;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5">
      <div className="flex items-start gap-3">
        <span className="text-brand-600 mt-0.5">
          <AlertTriangle size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold tracking-tight text-brand-900">
            Gefahrenzone
          </h3>
          <p className="mt-1 text-sm text-brand-800">
            Das Turnier komplett löschen — inklusive aller Spielklassen,
            Teilnehmer und Ergebnisse. Lässt sich nicht rückgängig machen.
          </p>

          {!confirmingDelete ? (
            <button
              type="button"
              className="mt-4 btn-danger btn-sm inline-flex items-center gap-1.5"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash size={14} /> Turnier löschen
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-brand-900">
                Zur Sicherheit: tippe den Slug{" "}
                <code className="kbd">{slug}</code> ein.
              </label>
              <input
                className="input font-mono"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                placeholder={slug}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setTyped("");
                  }}
                  disabled={busy}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="btn-danger btn-sm inline-flex items-center gap-1.5"
                  disabled={!matches || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onDelete();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash size={14} />
                  {busy ? "Lösche..." : "Endgültig löschen"}
                </button>
              </div>
            </div>
          )}
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
