"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DrawPanel({
  categoryId,
  participantCount,
}: {
  categoryId: string;
  participantCount: number;
}) {
  const router = useRouter();
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDraw = participantCount >= 4;

  return (
    <section className="card p-5 space-y-3">
      <h2 className="text-lg font-semibold">Gruppen auslosen</h2>
      <p className="text-sm text-slate-500">
        Erzeugt Gruppen, Round-Robin-Spielplan und Spielzeiten. Danach können
        keine Teilnehmer mehr hinzugefügt werden.
      </p>
      <div className="flex gap-3 items-end">
        <div className="flex-1 max-w-xs">
          <label className="label">Seed (optional, für Reproduzierbarkeit)</label>
          <input
            className="input"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="z.B. 'svutt-2026'"
          />
        </div>
        <button
          className="btn-primary"
          disabled={!canDraw || loading}
          onClick={async () => {
            if (!confirm("Auslosung jetzt durchführen? Das ist nicht rückgängig.")) return;
            setError(null);
            setLoading(true);
            try {
              const res = await fetch(`/api/categories/${categoryId}/draw`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ seed: seed || undefined }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data.error ?? "Fehler beim Auslosen.");
                return;
              }
              router.refresh();
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Lose…" : "Jetzt auslosen"}
        </button>
      </div>
      {!canDraw && (
        <p className="text-sm text-amber-700">
          Mindestens 4 Teilnehmer nötig ({participantCount} vorhanden).
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
