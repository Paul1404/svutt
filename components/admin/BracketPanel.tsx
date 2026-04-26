"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Category,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import { MatchResultDialog } from "./MatchResultDialog";
import { Trophy } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import { TreeBracket, type BracketOrigin } from "@/components/TreeBracket";

type Props = {
  tournamentId: string;
  category: Category;
  koMatches: Match[];
  losersMatches?: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
  origins?: Map<string, BracketOrigin>;
  canBuild: boolean;
};

export function BracketPanel({
  category,
  koMatches,
  losersMatches,
  sets,
  participants,
  origins,
  canBuild,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const partsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );

  const setsByMatch = useMemo(() => {
    const m = new Map<string, MatchSetRow[]>();
    for (const s of sets) {
      const a = m.get(s.matchId) ?? [];
      a.push(s);
      m.set(s.matchId, a);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.setNumber - b.setNumber);
    return m;
  }, [sets]);

  async function build() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${category.id}/bracket`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Finalbaum konnte nicht erstellt werden.");
        return;
      }
      toast.show({
        message: "Finalbaum erstellt.",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function togglePlayed(matchId: string, next: boolean) {
    const res = await fetch(`/api/matches/${matchId}/played`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ played: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.show({
        message:
          typeof data?.error === "string"
            ? data.error
            : "Markierung fehlgeschlagen.",
      });
      return;
    }
    router.refresh();
  }

  const allMatches = [...koMatches, ...(losersMatches ?? [])];
  const openMatch = allMatches.find((m) => m.id === openMatchId) ?? null;
  const hasLosers = !!losersMatches && losersMatches.length > 0;
  const finalsOnly = category.structure === "round_robin_finals";
  const buildLabel = finalsOnly ? "Finalspiele" : "Finalbaum";

  return (
    <section className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Finalrunde
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {finalsOnly
                ? "Platz 1 gegen 2 im Finale, Platz 3 gegen 4 um Bronze."
                : category.luckyLoserEnabled
                  ? "Gesetzter KO-Baum: die Gruppenbesten ziehen ein, die Stärksten bekommen ein Freilos in die nächste Runde. Nicht qualifizierte Spieler:innen bilden die Trostrunde."
                  : "Gesetzter KO-Baum: die Gruppenbesten ziehen ein, die Stärksten bekommen ein Freilos in die nächste Runde."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!canBuild || loading}
          onClick={async () => {
            if (koMatches.length > 0) {
              const ok = await confirm({
                title: `${buildLabel} neu aufbauen`,
                message: `Die bestehenden ${buildLabel.toLowerCase()} werden komplett neu erstellt. Bereits eingetragene KO-Ergebnisse gehen verloren.`,
                confirmLabel: "Neu aufbauen",
                variant: "danger",
              });
              if (!ok) return;
            }
            build();
          }}
        >
          {loading
            ? "Wird erstellt..."
            : koMatches.length > 0
              ? "Neu aufbauen"
              : `${buildLabel} erstellen`}
        </button>
      </div>

      {!canBuild && koMatches.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {finalsOnly
            ? "Erst alle Ligaspiele abschließen, dann kannst du die Finalspiele starten."
            : "Erst alle Gruppenspiele abschließen, dann kannst du den Finalbaum starten."}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {error}
        </div>
      )}

      {koMatches.length > 0 && (
        <div className="overflow-x-auto -mx-6 px-6 pt-6">
          <TreeBracket
            matches={koMatches}
            sets={sets}
            participants={participants}
            origins={origins}
            highlightFinal
            onMatchClick={(m) => setOpenMatchId(m.id)}
            onTogglePlayed={(m, next) => togglePlayed(m.id, next)}
          />
        </div>
      )}

      {hasLosers && (
        <div className="space-y-2 pt-4 border-t border-ink-100">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Trostrunde (Lucky Loser)
            </h3>
            <p className="mt-0.5 text-sm text-ink-500">
              Zweiter Baum mit allen, die sich nicht für den Hauptbaum
              qualifiziert haben.
            </p>
          </div>
          <div className="overflow-x-auto -mx-6 px-6 pt-6">
            <TreeBracket
              matches={losersMatches!}
              sets={sets}
              participants={participants}
              origins={origins}
              onMatchClick={(m) => setOpenMatchId(m.id)}
              onTogglePlayed={(m, next) => togglePlayed(m.id, next)}
            />
          </div>
        </div>
      )}

      {openMatch && openMatch.participantAId && openMatch.participantBId && (
        <MatchResultDialog
          match={openMatch}
          sets={setsByMatch.get(openMatch.id) ?? []}
          playerA={partsById.get(openMatch.participantAId)!}
          playerB={partsById.get(openMatch.participantBId)!}
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </section>
  );
}
