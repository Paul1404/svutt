import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";
import { TreeBracket, type BracketOrigin } from "@/components/TreeBracket";
import { Trophy } from "@/components/Icon";

type Props = {
  koMatches: Match[];
  losersMatches?: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
  origins?: Map<string, BracketOrigin>;
};

export function PublicBracket({
  koMatches,
  losersMatches,
  sets,
  participants,
  origins,
}: Props) {
  const hasLosers = !!losersMatches && losersMatches.length > 0;
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <header className="flex items-start gap-3">
          <span className="mt-1 hidden sm:inline-block h-7 w-0.5 rounded-full bg-gradient-to-b from-brand-500 via-brand-400 to-brand-200" />
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/60">
            <Trophy size={18} />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700">
              KO-Phase
            </div>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
              Finalrunde
            </h2>
            <p className="mt-1 text-sm text-ink-500 max-w-xl">
              Hauptbaum der Gruppenbesten. Freie Paarungen ohne Gegner:in
              (Freilose) bedeuten: dieser Spieler zieht kampflos in die nächste
              Runde ein.
            </p>
          </div>
        </header>
        <div className="overflow-x-auto -mx-4 px-4 pt-6">
          <TreeBracket
            matches={koMatches}
            sets={sets}
            participants={participants}
            origins={origins}
            highlightFinal
          />
        </div>
      </section>

      {hasLosers && (
        <section className="space-y-3">
          <header className="flex items-start gap-3">
            <span className="mt-1 hidden sm:inline-block h-7 w-0.5 rounded-full bg-gradient-to-b from-ink-400 via-ink-300 to-ink-200" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">
                Nebenrunde
              </div>
              <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
                Trostrunde (Lucky Loser)
              </h2>
              <p className="mt-1 text-sm text-ink-500 max-w-xl">
                Zweiter Finalbaum für alle, die es nicht in die Hauptrunde
                geschafft haben.
              </p>
            </div>
          </header>
          <div className="overflow-x-auto -mx-4 px-4 pt-6">
            <TreeBracket
              matches={losersMatches!}
              sets={sets}
              participants={participants}
              origins={origins}
            />
          </div>
        </section>
      )}
    </div>
  );
}
