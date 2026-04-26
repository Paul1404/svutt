import { matchNumber } from "@/lib/matchLabel";

type Set = { pointsA: number; pointsB: number };

type Props = {
  match: { playOrder?: number | null; tableNumber?: number | null };
  sets?: Set[];
  className?: string;
};

export function MatchMeta({ match, sets, className = "" }: Props) {
  const num = matchNumber(match);
  const table = match.tableNumber;
  const hasSets = sets && sets.length > 0;
  if (num === null && typeof table !== "number" && !hasSets) return null;

  return (
    <div
      className={`flex items-center gap-1.5 flex-wrap text-[11px] ${className}`}
    >
      {num !== null && (
        <span className="inline-flex items-center rounded-md bg-ink-100 px-1.5 py-[1px] font-mono font-semibold tabular-nums text-ink-600 ring-1 ring-inset ring-ink-200/70">
          {num}
        </span>
      )}
      {typeof table === "number" && (
        <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-[1px] font-mono font-semibold tabular-nums text-brand-700 ring-1 ring-inset ring-brand-200/70">
          T{table}
        </span>
      )}
      {hasSets && (
        <span className="font-mono tabular-nums text-ink-500 pl-0.5">
          {sets!.map((s) => `${s.pointsA}:${s.pointsB}`).join("  ")}
        </span>
      )}
    </div>
  );
}
