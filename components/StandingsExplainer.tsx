import { ChevronDown } from "@/components/Icon";

type Rule = {
  short: string;
  full: string;
  detail: string;
};

const RULES: Rule[] = [
  {
    short: "S",
    full: "Siege",
    detail: "Anzahl gewonnener Spiele.",
  },
  {
    short: "Sätze",
    full: "Satzdifferenz",
    detail: "Gewonnene minus verlorene Sätze, über alle Spiele zusammengezählt.",
  },
  {
    short: "Pkt",
    full: "Punktdifferenz",
    detail: "Gewonnene minus verlorene Ballpunkte, über alle Sätze zusammengezählt.",
  },
  {
    short: "DV",
    full: "Direkter Vergleich",
    detail:
      "Greift nur, wenn genau zwei Spielerinnen oder Spieler in allen Werten darüber gleichauf liegen — dann zählt das Spiel zwischen den beiden.",
  },
  {
    short: "Setzliste",
    full: "Setzliste / Reihenfolge",
    detail: "Letzte Rückfallregel: gesetzte Reihenfolge bzw. Eintragungsreihenfolge.",
  },
];

/**
 * Read-only explainer of how the group standings are computed. Compact
 * collapsed state, numbered cards when expanded so the order of criteria
 * is visible at a glance.
 */
export function StandingsExplainer() {
  return (
    <details className="group rounded-xl border border-ink-100 bg-surface overflow-hidden">
      <summary className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer list-none hover:bg-ink-50 transition-colors">
        <span className="text-sm font-medium text-ink-700">
          Wie wird die Tabelle berechnet?
        </span>
        <span className="text-ink-400 transition-transform group-open:rotate-180">
          <ChevronDown size={16} />
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-ink-600 space-y-3">
        <p className="text-ink-500">
          Die Platzierung in jeder Gruppe richtet sich der Reihe nach an
          diesen Kriterien aus. Erst bei Gleichstand wird das nächste
          herangezogen.
        </p>
        <ol className="grid gap-2 sm:grid-cols-2">
          {RULES.map((r, i) => (
            <li
              key={r.short}
              className="rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-semibold text-ink-800">{r.full}</span>
                <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-ink-400">
                  {r.short}
                </span>
              </div>
              <p className="mt-1.5 pl-8 text-[13px] text-ink-600 leading-relaxed">
                {r.detail}
              </p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-500">
          Unfertige Spiele zählen nicht; sobald ein Ergebnis steht, aktualisiert
          sich die Tabelle. Die Spalte <em>S</em> zeigt{" "}
          <span className="font-mono tabular-nums">Siege–Niederlagen</span>,{" "}
          <em>Sätze</em> ist <span className="font-mono tabular-nums">gew.:verl.</span>,{" "}
          <em>Pkt</em> die Punktdifferenz mit Vorzeichen.
        </p>
      </div>
    </details>
  );
}
