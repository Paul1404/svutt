import { ChevronDown } from "@/components/Icon";

/**
 * Read-only explainer of how the group standings are computed. Kept lean
 * so it fits inside a `<details>` without overwhelming the admin view.
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
        <p>
          Die Platzierung in jeder Gruppe richtet sich nach den folgenden
          Kriterien — jeweils in dieser Reihenfolge, erst bei Gleichstand wird
          das nächste Kriterium gezogen:
        </p>
        <ol className="list-decimal pl-5 space-y-1 marker:text-ink-400">
          <li>
            <strong>Siege</strong> (S): Anzahl gewonnener Spiele.
          </li>
          <li>
            <strong>Satzdifferenz</strong> (Sätze): gewonnene Sätze minus
            verlorene Sätze, über alle Spiele summiert.
          </li>
          <li>
            <strong>Punktdifferenz</strong> (Pkt): gewonnene Ballpunkte minus
            verlorene Ballpunkte, über alle Sätze summiert.
          </li>
          <li>
            <strong>Direkter Vergleich</strong>: nur wenn genau zwei Spieler
            in allen drei Werten darüber gleich sind — dann entscheidet, wer
            das Spiel gegen den anderen gewonnen hat.
          </li>
          <li>
            <strong>Setzliste</strong> (Seed) bzw. Eintragungsreihenfolge, als
            letzte Rückfallregel.
          </li>
        </ol>
        <p className="text-xs text-ink-500">
          Unfertige Spiele zählen nicht; sobald ein Ergebnis steht, aktualisiert
          sich die Tabelle automatisch. Die Spalte <em>S</em> zeigt{" "}
          <span className="font-mono tabular-nums">Siege-Niederlagen</span>,
          <em> Sätze</em> ist <span className="font-mono tabular-nums">gew.:verl.</span>, und
          <em> Pkt</em> ist die Punktdifferenz mit Vorzeichen.
        </p>
      </div>
    </details>
  );
}
