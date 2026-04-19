"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "@/components/Icon";

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
  const [setPoints, setSetPoints] = useState(11);
  const [setMinLead, setSetMinLead] = useState(2);
  const [luckyLoserEnabled, setLuckyLoserEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        className="btn-secondary inline-flex items-center gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} /> Spielklasse hinzufügen
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
                setPoints,
                setMinLead,
                luckyLoserEnabled,
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
          setShowAdvanced(false);
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
          <p className="mt-1.5 text-xs text-ink-500">
            Wird in der öffentlichen URL verwendet — nur Kleinbuchstaben, Zahlen
            und Bindestriche.
          </p>
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
          <p className="mt-1.5 text-xs text-ink-500">
            4 bis 8 Spieler. Bei knapper Teilnehmerzahl werden Gruppen leicht
            vergrößert oder verkleinert.
          </p>
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

      <div>
        <button
          type="button"
          className="text-xs font-medium text-ink-500 hover:text-brand-600"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "− " : "+ "}Erweiterte Tischtennis-Regeln
        </button>
      </div>
      {showAdvanced && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-ink-200 bg-ink-50/40 p-4">
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
              Standard: 11. Schulturnier z.B. 15 oder 21.
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
              Standard: 2 (Einstand-Regel ab 10:10).
            </p>
          </div>
          <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer rounded-lg border border-ink-200 bg-surface p-3 hover:border-brand-300 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={luckyLoserEnabled}
              onChange={(e) => setLuckyLoserEnabled(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Lucky Loser zulassen</span>
              <span className="block text-xs text-ink-500 mt-0.5">
                Wenn die Anzahl der Gruppen keine Zweierpotenz ist, werden die
                besten Gruppendritten in den Finalbaum nachgerückt. Wenn aus,
                bleiben Plätze frei (Freilos).
              </span>
            </span>
          </label>
        </div>
      )}

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
