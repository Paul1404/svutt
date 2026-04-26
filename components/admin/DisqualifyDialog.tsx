"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, Participant } from "@/lib/db/schema";
import { useToast } from "@/components/Toast";
import { AlertTriangle } from "@/components/Icon";
import { displayName } from "@/lib/displayName";

type Props = {
  match: Match;
  playerA: Participant;
  playerB: Participant;
  onClose: () => void;
};

/**
 * Modal that lets the admin disqualify one of the two players from a running
 * match. The opponent automatically wins the match by forfeit. Standings get
 * a clean sweep credit so they recompute correctly without special casing.
 */
export function DisqualifyDialog({ match, playerA, playerB, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function disqualify(forfeitParticipantId: string) {
    setError(null);
    setPicked(forfeitParticipantId);
    setSaving(true);
    try {
      const res = await fetch(`/api/matches/${match.id}/forfeit`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ forfeitParticipantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Disqualifikation hat nicht geklappt.",
        );
        return;
      }
      const dqPlayer =
        forfeitParticipantId === playerA.id ? playerA : playerB;
      const winner =
        forfeitParticipantId === playerA.id ? playerB : playerA;
      toast.show({
        message: `${displayName(dqPlayer.name)} disqualifiziert. ${displayName(winner.name)} gewinnt.`,
      });
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="disqualify-heading"
        className="card w-full max-w-md shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1">
            <AlertTriangle size={14} />
            Disqualifikation
          </div>
          <h3
            id="disqualify-heading"
            className="text-lg font-semibold tracking-tight leading-snug"
          >
            Wer wird disqualifiziert?
          </h3>
          <p className="mt-2 text-sm text-ink-500">
            Der andere Spieler gewinnt das Spiel automatisch. Der Eintrag kann
            später über „Ergebnis löschen“ rückgängig gemacht werden.
          </p>
        </div>

        <div className="px-6 py-5 space-y-2.5">
          <PlayerChoice
            player={playerA}
            opponent={playerB}
            picked={picked === playerA.id}
            disabled={saving}
            onClick={() => disqualify(playerA.id)}
          />
          <PlayerChoice
            player={playerB}
            opponent={playerA}
            picked={picked === playerB.id}
            disabled={saving}
            onClick={() => disqualify(playerB.id)}
          />

          {error && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-ink-100 bg-ink-50/50 rounded-b-xl">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerChoice({
  player,
  opponent,
  picked,
  disabled,
  onClick,
}: {
  player: Participant;
  opponent: Participant;
  picked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group/choice w-full text-left rounded-xl ring-1 px-4 py-3 transition-all ${
        picked
          ? "bg-brand-600 text-white ring-brand-700 shadow-pop"
          : "bg-surface ring-ink-200 hover:ring-brand-400 hover:bg-brand-50/50 disabled:opacity-50"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div
            className={`text-[10px] font-bold uppercase tracking-wider ${
              picked ? "text-white/70" : "text-ink-500"
            }`}
          >
            disqualifizieren
          </div>
          <div className="mt-0.5 text-base font-bold tracking-tight truncate">
            {displayName(player.name)}
          </div>
        </div>
        <div
          className={`text-right text-xs ${
            picked ? "text-white/80" : "text-ink-500"
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider">
            Gewinner
          </div>
          <div className="mt-0.5 font-semibold truncate">
            {displayName(opponent.name)}
          </div>
        </div>
      </div>
    </button>
  );
}
