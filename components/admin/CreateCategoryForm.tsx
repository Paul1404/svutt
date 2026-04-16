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

export function CreateCategoryForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [groupSize, setGroupSize] = useState(4);
  const [winSets, setWinSets] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <span className="text-base leading-none">+</span> Spielklasse hinzufügen
      </button>
    );
  }

  return (
    <form
      className="card p-5 space-y-4 max-w-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          const res = await fetch(
            `/api/tournaments/${tournamentId}/categories`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                slug: slug || toSlug(name),
                groupSize,
                winSets,
              }),
            },
          );
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? "Speichern hat nicht geklappt.");
            return;
          }
          router.refresh();
          setOpen(false);
          setName("");
          setSlug("");
          setSlugEdited(false);
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3 className="font-semibold tracking-tight">Neue Spielklasse</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input
            className="input"
            placeholder="z.B. Herren, Damen, Jugend U18"
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
          <label className="label">URL-Kürzel</label>
          <input
            className="input font-mono"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            pattern="[a-z0-9-]+"
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
            onChange={(e) => setGroupSize(parseInt(e.target.value, 10))}
          />
          <p className="mt-1.5 text-xs text-ink-500">4 bis 8 Spieler.</p>
        </div>
        <div>
          <label className="label">Spielmodus</label>
          <select
            className="input"
            value={winSets}
            onChange={(e) => setWinSets(parseInt(e.target.value, 10))}
          >
            <option value={2}>Best of 3 (2 Gewinnsätze)</option>
            <option value={3}>Best of 5 (3 Gewinnsätze)</option>
            <option value={4}>Best of 7 (4 Gewinnsätze)</option>
          </select>
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
          {saving ? "Speichern..." : "Anlegen"}
        </button>
      </div>
    </form>
  );
}
