"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function CreateTournamentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [parallelTables, setParallelTables] = useState(3);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(11);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <span className="text-base leading-none">+</span> Neues Turnier
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 backdrop-blur-sm p-4">
      <form
        className="card w-full max-w-2xl p-6 space-y-5 shadow-pop"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaving(true);
          try {
            const res = await fetch("/api/tournaments", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                slug: slug || toSlug(name),
                location: location || undefined,
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
            router.push(`/admin/t/${data.tournament.id}`);
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Neues Turnier anlegen
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Name und Ort reichen fürs Erste. Den Rest kannst du später noch
            anpassen.
          </p>
        </div>

        <div className="divider" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Turniername</label>
            <input
              className="input"
              placeholder="z.B. Sommer-Open 2026"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(toSlug(e.target.value));
              }}
              required
              autoFocus
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Kürzel für die URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 font-mono pointer-events-none">
                /t/
              </span>
              <input
                className="input pl-10 font-mono"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                pattern="[a-z0-9-]+"
                required
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Ort</label>
            <input
              className="input"
              placeholder="Sporthalle Musterstadt"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Startzeit</label>
            <input
              className="input"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
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
          </div>
          <div className="sm:col-span-2">
            <label className="label">Spiel dauert etwa (Minuten)</label>
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
              Daraus rechnen wir den Spielplan und die Startzeiten pro Tisch.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Abbrechen
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Wird angelegt..." : "Turnier anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}
