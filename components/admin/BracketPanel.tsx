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
import { TreeBracket } from "@/components/TreeBracket";

type Props = {
  tournamentId: string;
  category: Category;
  koMatches: Match[];
  losersMatches?: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
  canBuild: boolean;
};

export function BracketPanel({
  category,
  koMatches,
  losersMatches,
  sets,
  participants,
  canBuild,
}: Props) {
  const router = useRouter();
  const toast = useToast();
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

  const allMatches = [...koMatches, ...(losersMatches ?? [])];
  const openMatch = allMatches.find((m) => m.id === openMatchId) ?? null;
  const hasLosers = !!losersMatches && losersMatches.length > 0;

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
              Hauptbaum mit den Gruppenbesten
              {category.luckyLoserEnabled
                ? " und separater Trostrunde für alle anderen."
                : "."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!canBuild || loading}
          onClick={() => {
            if (
              koMatches.length > 0 &&
              !confirm(
                "Der bestehende Finalbaum wird komplett neu erstellt. Weiter?",
              )
            )
              return;
            build();
          }}
        >
          {loading
            ? "Wird erstellt..."
            : koMatches.length > 0
              ? "Neu aufbauen"
              : "Finalbaum erstellen"}
        </button>
      </div>

      {!canBuild && koMatches.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Erst alle Gruppenspiele abschließen, dann kannst du den Finalbaum
          starten.
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
            highlightFinal
            onMatchClick={(m) => setOpenMatchId(m.id)}
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
              onMatchClick={(m) => setOpenMatchId(m.id)}
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
