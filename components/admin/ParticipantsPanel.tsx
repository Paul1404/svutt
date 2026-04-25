"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Participant } from "@/lib/db/schema";
import { useToast } from "@/components/Toast";

export function ParticipantsPanel({
  categoryId,
  participants,
}: {
  categoryId: string;
  participants: Participant[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [bulk, setBulk] = useState("");
  const [club, setClub] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function removeParticipant(
    pid: string,
    name: string,
    clubName: string | null,
  ) {
    const res = await fetch(
      `/api/categories/${categoryId}/participants/${pid}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      toast.show({
        message: `${name} entfernt.`,
        undo: async () => {
          await fetch(`/api/categories/${categoryId}/participants`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              names: name,
              club: clubName || undefined,
            }),
          });
          router.refresh();
        },
      });
      router.refresh();
    }
  }

  const nameCount = bulk
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <section className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Teilnehmer eintragen
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Einfach die Namen untereinander reinkopieren, einen pro Zeile.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">
            {participants.length}
          </div>
          <div className="text-xs uppercase tracking-wider text-ink-500">
            {participants.length === 1 ? "Spieler" : "Spieler"}
          </div>
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaving(true);
          try {
            const res = await fetch(
              `/api/categories/${categoryId}/participants`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  names: bulk,
                  club: club || undefined,
                }),
              },
            );
            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "Speichern hat nicht geklappt.");
              return;
            }
            const added = Array.isArray(data?.participants)
              ? data.participants.length
              : nameCount;
            toast.show({
              message:
                added === 1
                  ? "1 Teilnehmer hinzugefügt."
                  : `${added} Teilnehmer hinzugefügt.`,
            });
            setBulk("");
            setClub("");
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <label className="label flex items-center justify-between">
            <span>Namen</span>
            {nameCount > 0 && (
              <span className="text-ink-400 font-normal normal-case tracking-normal">
                {nameCount} {nameCount === 1 ? "Name" : "Namen"}
              </span>
            )}
          </label>
          <textarea
            className="input h-44 font-mono text-sm leading-relaxed"
            placeholder={"Max Mustermann\nLisa Müller\nTobias Keller"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Verein (optional)</label>
            <input
              className="input"
              placeholder="Wird allen Spielern zugewiesen"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={saving || !bulk.trim()}>
            {saving ? "Hinzufügen..." : "Hinzufügen"}
          </button>
        </div>
        {error && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {error}
          </div>
        )}
      </form>

      {participants.length > 0 && (
        <div>
          <div className="divider mb-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">
            Eingetragen ({participants.length})
          </h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {participants.map((p, i) => (
              <li
                key={p.id}
                id={`player-row-${p.id}`}
                className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-ink-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-[10px] font-mono text-ink-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.name}
                    </div>
                    {p.club && (
                      <div className="text-xs text-ink-500 truncate">
                        {p.club}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-ink-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  onClick={() => removeParticipant(p.id, p.name, p.club)}
                  aria-label={`${p.name} entfernen`}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
