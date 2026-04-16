"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Tournament } from "@/lib/db/schema";

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

  if (!open) {
    return (
      <div className="card p-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Start: <b>{tournament.startTime}</b> • Tische:{" "}
          <b>{tournament.parallelTables}</b> • Spieldauer:{" "}
          <b>{tournament.matchDurationMinutes} min</b>
        </div>
        <button className="btn-secondary" onClick={() => setOpen(true)}>
          Bearbeiten
        </button>
      </div>
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
            setError(data.error ?? "Fehler beim Speichern.");
            return;
          }
          setOpen(false);
          router.refresh();
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
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
          {saving ? "Speichert…" : "Speichern"}
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
