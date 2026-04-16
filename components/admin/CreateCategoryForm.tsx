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
        + Spielklasse hinzufügen
      </button>
    );
  }

  return (
    <form
      className="card p-4 space-y-4 max-w-xl"
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
            setError(data.error ?? "Fehler beim Speichern.");
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
      <div className="grid gap-3 sm:grid-cols-2">
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
        <div>
          <label className="label">Slug</label>
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
        <div>
          <label className="label">Gruppengröße (Soll)</label>
          <input
            className="input"
            type="number"
            min={4}
            max={8}
            value={groupSize}
            onChange={(e) => setGroupSize(parseInt(e.target.value, 10))}
          />
        </div>
        <div>
          <label className="label">Gewinnsätze (Best-of {winSets * 2 - 1})</label>
          <input
            className="input"
            type="number"
            min={2}
            max={4}
            value={winSets}
            onChange={(e) => setWinSets(parseInt(e.target.value, 10))}
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
