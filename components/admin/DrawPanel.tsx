"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dice } from "@/components/Icon";
import { HelpTooltip } from "@/components/Tooltip";
import { useToast } from "@/components/Toast";

export function DrawPanel({
  categoryId,
  participantCount,
}: {
  categoryId: string;
  participantCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDraw = participantCount >= 4;

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Dice size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Gruppen auslosen
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Wir verteilen alle Spieler zufällig auf Gruppen und erstellen den
            Spielplan mit Tischen und Startzeiten. Danach lassen sich keine
            Spieler mehr hinzufügen.
          </p>
        </div>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="label mb-0">Seed (optional)</span>
            <HelpTooltip label="Seed">
              Ein kurzer Text, aus dem die Losung berechnet wird. Gleicher
              Seed = gleiches Ergebnis. Praktisch, wenn du die Losung
              vorher öffentlich ankündigst oder reproduzieren musst.
            </HelpTooltip>
          </div>
          <input
            className="input"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="z.B. svutt-2026"
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Leer lassen für eine zufällige Losung.
          </p>
        </div>
        <button
          className="btn-primary"
          disabled={!canDraw || loading}
          onClick={async () => {
            if (
              !confirm(
                "Losung jetzt starten? Das kann hinterher nicht rückgängig gemacht werden.",
              )
            )
              return;
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
                setError(data.error ?? "Losung hat nicht geklappt.");
                return;
              }
              toast.show({
                message: "Losung erstellt und Spielplan erzeugt.",
              });
              router.refresh();
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Losen..." : "Jetzt auslosen"}
        </button>
      </div>

      {!canDraw && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Du brauchst mindestens 4 Spieler. Aktuell sind es {participantCount}.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {error}
        </div>
      )}
    </section>
  );
}
