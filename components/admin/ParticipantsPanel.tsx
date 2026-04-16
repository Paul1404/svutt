"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Participant } from "@/lib/db/schema";

export function ParticipantsPanel({
  categoryId,
  participants,
}: {
  categoryId: string;
  participants: Participant[];
}) {
  const router = useRouter();
  const [bulk, setBulk] = useState("");
  const [club, setClub] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function removeParticipant(pid: string) {
    if (!confirm("Teilnehmer wirklich entfernen?")) return;
    const res = await fetch(
      `/api/categories/${categoryId}/participants/${pid}`,
      { method: "DELETE" },
    );
    if (res.ok) router.refresh();
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Teilnehmer</h2>
          <p className="text-sm text-slate-500">
            Füge Spieler einzeln oder per Bulk-Paste (ein Name pro Zeile) hinzu.
          </p>
        </div>
        <div className="text-sm text-slate-500">{participants.length} Spieler</div>
      </div>

      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaving(true);
          try {
            const res = await fetch(`/api/categories/${categoryId}/participants`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                names: bulk,
                club: club || undefined,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "Fehler beim Speichern.");
              return;
            }
            setBulk("");
            setClub("");
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <label className="label">Namen (zeilenweise)</label>
          <textarea
            className="input h-40 font-mono"
            placeholder={"Max Mustermann\nLisa Müller\nTobias Keller"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">Verein (optional, wird allen zugewiesen)</label>
            <input
              className="input"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button className="btn-primary" disabled={saving || !bulk.trim()}>
              {saving ? "Speichert…" : "Hinzufügen"}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {participants.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                {p.club && (
                  <div className="text-xs text-slate-500">{p.club}</div>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => removeParticipant(p.id)}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
