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
        + Turnier erstellen
      </button>
    );
  }

  return (
    <form
      className="card p-4 space-y-4"
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
            setError(data.error ?? "Fehler beim Speichern.");
            return;
          }
          router.push(`/admin/t/${data.tournament.id}`);
          router.refresh();
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(toSlug(e.target.value));
            }}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">Slug (URL)</label>
          <input
            className="input"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            pattern="[a-z0-9-]+"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Ort</label>
          <input
            className="input"
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
          <label className="label">Parallele Tische</label>
          <input
            className="input"
            type="number"
            min={1}
            max={32}
            value={parallelTables}
            onChange={(e) => setParallelTables(parseInt(e.target.value, 10))}
          />
        </div>
        <div>
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
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Wird gespeichert…" : "Speichern"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
