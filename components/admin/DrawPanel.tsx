"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dice } from "@/components/Icon";
import { HelpTooltip } from "@/components/Tooltip";
import { useToast } from "@/components/Toast";
import type { TournamentStructure } from "@/lib/engine/format";

const COPY: Record<
  TournamentStructure,
  { title: string; body: string; action: string; minPlayers: number }
> = {
  groups_ko: {
    title: "Gruppen auslosen",
    body: "Wir verteilen alle Spieler zufällig auf Gruppen und erstellen den Spielplan mit Tischen und Startzeiten. Danach lassen sich keine Spieler mehr hinzufügen.",
    action: "Jetzt auslosen",
    minPlayers: 4,
  },
  round_robin: {
    title: "Spielplan erstellen",
    body: "Alle Teilnehmer spielen gegen alle. Wir bauen den Spielplan und verteilen ihn auf die Tische.",
    action: "Spielplan erzeugen",
    minPlayers: 2,
  },
  ko_only: {
    title: "Finalbaum aufbauen",
    body: "Wir setzen die Teilnehmer in den KO-Baum. Gesetzte Spieler nach Setzliste, der Rest per Los. Nach dem Erstellen lassen sich keine Teilnehmer mehr hinzufügen.",
    action: "Baum erstellen",
    minPlayers: 2,
  },
  swiss: {
    title: "Erste Runde auslosen",
    body: "Wir paaren nach Setzplatz (Top-Hälfte gegen untere Hälfte). Nach jeder Runde kannst du die nächste per Knopfdruck erzeugen.",
    action: "Runde 1 auslosen",
    minPlayers: 2,
  },
};

export function DrawPanel({
  categoryId,
  participantCount,
  structure = "groups_ko",
}: {
  categoryId: string;
  participantCount: number;
  structure?: TournamentStructure;
}) {
  const router = useRouter();
  const toast = useToast();
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[structure];
  const canDraw = participantCount >= copy.minPlayers;

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Dice size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{copy.body}</p>
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
          {loading ? "Losen..." : copy.action}
        </button>
      </div>

      {!canDraw && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Du brauchst mindestens {copy.minPlayers} Spieler. Aktuell sind es{" "}
          {participantCount}.
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
