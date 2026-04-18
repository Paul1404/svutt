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
          <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
            Anpassen
          </button>
        </div>
      </div>
    );
  }

  return (
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
