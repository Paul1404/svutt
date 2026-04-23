import type { Match, MatchSetRow, Participant } from "@/lib/db/schema";
import { TreeBracket } from "@/components/TreeBracket";

type Props = {
  koMatches: Match[];
  losersMatches?: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
};

export function PublicBracket({
  koMatches,
  losersMatches,
  sets,
  participants,
}: Props) {
  const hasLosers = !!losersMatches && losersMatches.length > 0;
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">Finalrunde</h2>
        <div className="overflow-x-auto -mx-4 px-4 pt-6">
          <TreeBracket
            matches={koMatches}
            sets={sets}
            participants={participants}
            highlightFinal
          />
        </div>
      </section>

      {hasLosers && (
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Trostrunde (Lucky Loser)
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Zweiter Finalbaum für alle, die es nicht in die Hauptrunde
              geschafft haben.
            </p>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 pt-6">
            <TreeBracket
              matches={losersMatches!}
              sets={sets}
              participants={participants}
            />
          </div>
        </section>
      )}
    </div>
  );
}
