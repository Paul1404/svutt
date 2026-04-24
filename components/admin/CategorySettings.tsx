"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Category } from "@/lib/db/schema";
import {
  DRAW_MODES,
  DRAW_MODE_LABELS,
  TOURNAMENT_STRUCTURES,
  STRUCTURE_LABELS,
  type DrawMode,
  type TournamentStructure,
  isDrawMode,
  isTournamentStructure,
} from "@/lib/engine/format";
import { AlertTriangle, Settings, Sparkles, Trash, Users } from "@/components/Icon";
import { HelpTooltip } from "@/components/Tooltip";
import { useToast } from "@/components/Toast";
import { ChipGroup } from "@/components/admin/ChipGroup";
import {
  computePreview,
  formatDuration,
  suggestGroupSize,
} from "@/lib/preview";

const GROUP_SIZE_OPTIONS = [3, 4, 5, 6, 7, 8];
const WIN_SETS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Bo1" },
  { value: 2, label: "Bo3" },
  { value: 3, label: "Bo5" },
  { value: 4, label: "Bo7" },
];
const SET_POINT_CHIPS = [7, 11, 15, 21];
const LEAD_CHIPS = [1, 2];
const SWISS_ROUND_CHIPS = [3, 4, 5, 6, 7];

const STRUCTURE_DESCRIPTIONS: Record<TournamentStructure, string> = {
  groups_ko:
    "Klassisch: Gruppen­phase (jede:r gegen jede:n), danach KO-Finalbaum.",
  round_robin:
    "Alle spielen gegen alle. Eine einzige Rangliste, kein KO.",
  ko_only:
    "Direkter KO-Baum aus der Setzliste. Keine Gruppen, keine zweite Chance.",
  swiss:
    "Feste Rundenzahl, gepaart nach Punktgleichstand. Geeignet für viele Teilnehmer an kurzem Tag.",
};

const DRAW_MODE_DESCRIPTIONS: Record<DrawMode, string> = {
  random: "Rein zufällig, optional deterministisch per Seed.",
  seeded_snake:
    "Spieler werden nach ihrer Setzposition (Feld „Setzplatz“) im Schlangenverfahren auf die Gruppen verteilt. Top-Gesetzte landen in verschiedenen Gruppen.",
  paste_order:
    "Reihenfolge wie eingegeben: die ersten Spieler in Gruppe A, die nächsten in B, usw. Ohne Mischen oder Schlange.",
  manual:
    "Du ziehst jeden Spieler selbst in eine Gruppe oder einen Platz im Baum.",
};

export function CategorySettings({
  category,
  tournamentId,
  participantCount,
  parallelTables,
  matchDurationMinutes,
}: {
  category: Category;
  tournamentId: string;
  participantCount?: number;
  parallelTables?: number;
  matchDurationMinutes?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [groupSize, setGroupSize] = useState(category.groupSize);
  const [winSets, setWinSets] = useState(category.winSets);
  const [setPoints, setSetPoints] = useState(category.setPoints);
  const [setMinLead, setSetMinLead] = useState(category.setMinLead);
  const [groupAdvancementCount, setGroupAdvancementCount] = useState(
    category.groupAdvancementCount ?? 2,
  );
  const [luckyLoserEnabled, setLuckyLoserEnabled] = useState(
    category.luckyLoserEnabled,
  );
  const [structure, setStructure] = useState<TournamentStructure>(
    isTournamentStructure(category.structure) ? category.structure : "groups_ko",
  );
  const [drawMode, setDrawMode] = useState<DrawMode>(
    isDrawMode(category.drawMode) ? category.drawMode : "random",
  );
  const [swissRounds, setSwissRounds] = useState(category.swissRounds ?? 5);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);

  const drawn = category.drawDone;
  const deleteMatches = deleteTyped.trim() === category.slug;

  const preview = useMemo(
    () =>
      computePreview({
        participantCount: participantCount ?? 0,
        groupSize,
        luckyLoserEnabled,
        groupAdvancementCount,
        structure,
        swissRounds,
        matchDurationMinutes,
        parallelTables,
      }),
    [
      participantCount,
      groupSize,
      luckyLoserEnabled,
      groupAdvancementCount,
      structure,
      swissRounds,
      matchDurationMinutes,
      parallelTables,
    ],
  );

  const suggested =
    participantCount && participantCount >= 2
      ? suggestGroupSize(participantCount)
      : null;
  const showSuggestion =
    !drawn && suggested !== null && suggested !== groupSize;

  const currentStructure: TournamentStructure = isTournamentStructure(
    category.structure,
  )
    ? category.structure
    : "groups_ko";
  const currentDrawMode: DrawMode = isDrawMode(category.drawMode)
    ? category.drawMode
    : "random";

  if (!open) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat
              label="Struktur"
              value={STRUCTURE_LABELS[currentStructure]}
            />
            <Stat label="Auslosung" value={DRAW_MODE_LABELS[currentDrawMode]} />
            {currentStructure === "groups_ko" ||
            currentStructure === "round_robin" ? (
              <Stat label="Gruppen à" value={String(category.groupSize)} />
            ) : null}
            {currentStructure === "swiss" && (
              <Stat label="Runden" value={String(category.swissRounds)} />
            )}
            <Stat
              label="Modus"
              value={
                category.winSets === 1
                  ? "Bo1"
                  : `Best of ${category.winSets * 2 - 1}`
              }
            />
            <Stat
              label="Sätze"
              value={`${category.setPoints} Pkt, +${category.setMinLead}`}
            />
            {currentStructure === "groups_ko" && (
              <>
                <Stat
                  label="Aus Gruppe weiter"
                  value={`Top ${category.groupAdvancementCount ?? 2}`}
                />
                <Stat
                  label="Lucky Loser"
                  value={category.luckyLoserEnabled ? "an" : "aus"}
                />
              </>
            )}
          </div>
          <button
            className="btn-secondary btn-sm inline-flex items-center gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Settings size={14} /> Anpassen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="card p-5 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaving(true);
          try {
            const res = await fetch(`/api/categories/${category.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                ...(drawn
                  ? {}
                  : {
                      groupSize,
                      winSets,
                      structure,
                      drawMode,
                      swissRounds,
                    }),
                setPoints,
                setMinLead,
                groupAdvancementCount,
                luckyLoserEnabled,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "Speichern hat nicht geklappt.");
              return;
            }
            setOpen(false);
            toast.show({ message: "Einstellungen gespeichert." });
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <h3 className="font-semibold tracking-tight">Spielklasse anpassen</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Alle Regeln lassen sich auf diese Spielklasse zuschneiden. Die
            Vorschau rechts zeigt, was dabei herauskommt.
          </p>
        </div>
        {drawn && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Gruppen sind bereits gezogen — Gruppengröße und Spielmodus lassen
            sich nicht mehr ändern. Satz-Regeln bleiben anpassbar.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,18rem)]">
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="cat-name">
                Name der Spielklasse
              </label>
              <input
                id="cat-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Herren Einzel"
                required
              />
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="label mb-0">Struktur</span>
                <HelpTooltip label="Turnier­struktur">
                  <strong>Gruppen → KO</strong>: klassisch. Jede:r spielt in
                  einer Gruppe gegen alle, die Besten kommen ins KO.{" "}
                  <strong>Jeder gegen jeden</strong>: eine große Rangliste,
                  kein KO. <strong>KO-System</strong>: direkter Finalbaum aus
                  der Setzliste. <strong>Schweizer System</strong>: feste
                  Rundenzahl, in jeder Runde werden Spieler mit ähnlich vielen
                  Siegen gepaart.
                </HelpTooltip>
              </div>
              <ChipGroup
                options={TOURNAMENT_STRUCTURES.map((s) => ({
                  value: s,
                  label: STRUCTURE_LABELS[s],
                }))}
                value={structure}
                onChange={(v) => setStructure(v)}
                disabled={drawn}
              />
              <p className="mt-1.5 text-xs text-ink-500">
                {STRUCTURE_DESCRIPTIONS[structure]}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="label mb-0">Auslosung</span>
                <HelpTooltip label="Auslosungs­art">
                  <strong>Zufällig</strong>: die App mischt. Mit Seed
                  reproduzierbar. <strong>Gesetzt</strong>: nach Setzplatz
                  (Feld „Setzposition“ beim Teilnehmer), Top-Gesetzte landen
                  in verschiedenen Gruppen bzw. Ästen des Baums.{" "}
                  <strong>Manuell</strong>: du verteilst selbst
                  (Drag &amp; Drop, folgt).
                </HelpTooltip>
              </div>
              <ChipGroup
                options={DRAW_MODES.filter((m) => m !== "manual").map(
                  (m) => ({ value: m, label: DRAW_MODE_LABELS[m] }),
                )}
                value={drawMode === "manual" ? "random" : drawMode}
                onChange={(v) => setDrawMode(v)}
                disabled={drawn}
              />
              <p className="mt-1.5 text-xs text-ink-500">
                {DRAW_MODE_DESCRIPTIONS[drawMode]}
              </p>
            </div>

            {(structure === "groups_ko" || structure === "round_robin") && (
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="label mb-0">
                    {structure === "round_robin"
                      ? "Gruppen­größe (Referenz)"
                      : "Spieler pro Gruppe"}
                  </span>
                  <HelpTooltip label="Spieler pro Gruppe">
                    Jede:r spielt in der Gruppe gegen alle anderen. 4 ist klassisch
                    (6 Spiele pro Gruppe). Bei ungerader Teilnehmerzahl verteilen
                    wir die Überhänge automatisch, damit keine winzige Gruppe
                    entsteht. Bei „Jeder gegen jeden“ wird ohnehin eine einzige
                    Gruppe gebildet — der Wert dient nur der Ablage.
                  </HelpTooltip>
                </div>
                <ChipGroup
                  options={GROUP_SIZE_OPTIONS.map((n) => ({
                    value: n,
                    label: String(n),
                  }))}
                  value={groupSize}
                  onChange={setGroupSize}
                  disabled={drawn}
                />
                {showSuggestion && structure === "groups_ko" && (
                  <button
                    type="button"
                    onClick={() => setGroupSize(suggested)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                  >
                    <Sparkles size={12} />
                    Für {participantCount} Teilnehmer: Gruppengröße{" "}
                    <strong>{suggested}</strong> übernehmen
                  </button>
                )}
              </div>
            )}

            {structure === "swiss" && (
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="label mb-0">Runden</span>
                  <HelpTooltip label="Schweizer Runden">
                    Feste Rundenanzahl. Richtwert: <strong>ceil(log₂(N))</strong>
                    , mindestens 3. Für 16 Teilnehmer also 4 Runden, für 32
                    → 5.
                  </HelpTooltip>
                </div>
                <ChipGroup
                  options={SWISS_ROUND_CHIPS.map((n) => ({
                    value: n,
                    label: String(n),
                  }))}
                  value={swissRounds}
                  onChange={setSwissRounds}
                  disabled={drawn}
                  allowCustom
                  customMin={1}
                  customMax={15}
                  customLabel="Andere"
                />
              </div>
            )}

            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="label mb-0">Spielmodus</span>
                <HelpTooltip label="Best of — wie viele Sätze bis zum Sieg?">
                  <strong>Bo1</strong> = ein Satz entscheidet.{" "}
                  <strong>Bo3</strong> = zwei Gewinnsätze (klassisch im Breiten­sport).{" "}
                  <strong>Bo5</strong> = drei Gewinnsätze (Vereins­meisterschaft).{" "}
                  <strong>Bo7</strong> = vier Gewinnsätze (Profis).
                </HelpTooltip>
              </div>
              <ChipGroup
                options={WIN_SETS_OPTIONS}
                value={winSets}
                onChange={setWinSets}
                disabled={drawn}
              />
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="label mb-0">Satz-Punkte</span>
                <HelpTooltip label="Punkte pro Satz">
                  Wie viele Punkte braucht es, um einen Satz zu gewinnen. Die
                  offizielle Regel ist <strong>11</strong>. Früher war{" "}
                  <strong>21</strong> Standard, beides geht hier.
                </HelpTooltip>
              </div>
              <ChipGroup
                options={SET_POINT_CHIPS.map((n) => ({
                  value: n,
                  label: String(n),
                }))}
                value={setPoints}
                onChange={setSetPoints}
                allowCustom
                customMin={1}
                customMax={50}
                customLabel="Andere"
              />
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="label mb-0">Mindestvorsprung</span>
                <HelpTooltip label="Vorsprung am Satzende">
                  Wenn beide knapp sind, muss man mit diesem Vorsprung gewinnen
                  (Einstand). Standard im Tischtennis: <strong>2</strong>{" "}
                  (also 12:10, 13:11 …). Für ganz schnelle Spiele{" "}
                  <strong>1</strong>.
                </HelpTooltip>
              </div>
              <ChipGroup
                options={LEAD_CHIPS.map((n) => ({
                  value: n,
                  label: `+${n}`,
                }))}
                value={setMinLead}
                onChange={setSetMinLead}
                allowCustom
                customMin={1}
                customMax={10}
                customLabel="Andere"
              />
            </div>

            {structure === "groups_ko" && (
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="label mb-0">Aus jeder Gruppe weiter</span>
                  <HelpTooltip label="Qualifikanten pro Gruppe">
                    Wie viele der Top-Platzierten aus jeder Gruppe ziehen
                    direkt in den Finalbaum ein. Klassisch: die Top 2
                    (Gruppensieger und Zweite).
                  </HelpTooltip>
                </div>
                <ChipGroup
                  options={[1, 2, 3, 4].map((n) => ({
                    value: n,
                    label: `Top ${n}`,
                  }))}
                  value={groupAdvancementCount}
                  onChange={setGroupAdvancementCount}
                  disabled={drawn}
                />
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-ink-200 bg-surface p-3 hover:border-brand-300 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={luckyLoserEnabled}
                onChange={(e) => setLuckyLoserEnabled(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium inline-flex items-center gap-1">
                  Lucky-Loser-Trostrunde
                  <HelpTooltip label="Lucky-Loser-Trostrunde">
                    Wenn aktiv, spielen alle Nicht-Qualifizierten aus den
                    Gruppen (Ränge jenseits der „Aus Gruppe weiter“-Zahl)
                    einen eigenen, zweiten Finalbaum. So hat jede:r Teilnehmer
                    nach der Gruppenphase noch etwas zu spielen.
                  </HelpTooltip>
                </span>
                <span className="block text-xs text-ink-500 mt-0.5">
                  Zweiter Finalbaum mit den restlichen Gruppen-Spielern als
                  Trostrunde.
                </span>
              </span>
            </label>
          </div>

          <PreviewPanel
            participantCount={participantCount}
            groupSize={groupSize}
            winSets={winSets}
            luckyLoserEnabled={luckyLoserEnabled}
            preview={preview}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Abbrechen
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5">
        <div className="flex items-start gap-3">
          <span className="text-brand-600 mt-0.5">
            <AlertTriangle size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold tracking-tight text-brand-900">
              Spielklasse löschen
            </h3>
            <p className="mt-1 text-sm text-brand-800">
              Entfernt diese Spielklasse mit allen Teilnehmern, Gruppen und
              Spielen. Das Turnier selbst bleibt bestehen.
            </p>

            {!confirmingDelete ? (
              <button
                type="button"
                className="mt-4 btn-danger btn-sm inline-flex items-center gap-1.5"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash size={14} /> Spielklasse löschen
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-brand-900">
                  Tippe das Kürzel{" "}
                  <code className="kbd">{category.slug}</code> ein, um zu
                  bestätigen.
                </label>
                <input
                  className="input font-mono"
                  value={deleteTyped}
                  onChange={(e) => setDeleteTyped(e.target.value)}
                  autoFocus
                  placeholder={category.slug}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeleteTyped("");
                    }}
                    disabled={busyDelete}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm inline-flex items-center gap-1.5"
                    disabled={!deleteMatches || busyDelete}
                    onClick={async () => {
                      setBusyDelete(true);
                      try {
                        const res = await fetch(
                          `/api/categories/${category.id}`,
                          { method: "DELETE" },
                        );
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          setError(data.error ?? "Löschen hat nicht geklappt.");
                          return;
                        }
                        router.push(`/admin/t/${tournamentId}`);
                        router.refresh();
                      } finally {
                        setBusyDelete(false);
                      }
                    }}
                  >
                    <Trash size={14} />
                    {busyDelete ? "Lösche..." : "Endgültig löschen"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PreviewPanel({
  participantCount,
  groupSize,
  winSets,
  luckyLoserEnabled,
  preview,
}: {
  participantCount?: number;
  groupSize: number;
  winSets: number;
  luckyLoserEnabled: boolean;
  preview: ReturnType<typeof computePreview>;
}) {
  const hasCount = typeof participantCount === "number" && participantCount >= 2;

  return (
    <aside
      aria-label="Live-Vorschau der Turnierstruktur"
      className="rounded-xl border border-ink-200 bg-ink-50/50 p-4 space-y-3 h-fit lg:sticky lg:top-24"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-brand-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
          Live-Vorschau
        </span>
      </div>

      {!hasCount ? (
        <p className="text-xs text-ink-500 leading-relaxed">
          Füge Teilnehmer hinzu, dann siehst du hier den Spielplan und eine
          Zeit­schätzung.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <Users size={14} className="text-ink-500" />
            {participantCount} Teilnehmer
          </div>

          <p className="text-sm text-ink-800 leading-relaxed">
            {preview.summary}
          </p>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-ink-200/80 text-xs">
            {preview.structure === "swiss" ? (
              <>
                <PreviewStat
                  label="Runden"
                  value={String(preview.swissRounds)}
                />
                <PreviewStat
                  label="Spiele / Runde"
                  value={String(preview.swissMatchesPerRound)}
                />
              </>
            ) : (
              <>
                <PreviewStat
                  label="Gruppen­spiele"
                  value={String(preview.groupMatches)}
                />
                <PreviewStat
                  label="KO-Spiele"
                  value={
                    preview.hasKO
                      ? preview.losersKoMatches > 0
                        ? `${preview.koMatches} + ${preview.losersKoMatches}`
                        : String(preview.koMatches)
                      : "—"
                  }
                />
              </>
            )}
            <PreviewStat
              label="Spiele gesamt"
              value={String(preview.totalMatches)}
            />
            <PreviewStat
              label="Geschätzte Dauer"
              value={formatDuration(preview.estimatedMinutes)}
            />
          </div>

          <div className="pt-2 border-t border-ink-200/80 text-[11px] text-ink-500 leading-relaxed">
            Basierend auf {winSets === 1 ? "Bo1" : `Best of ${winSets * 2 - 1}`}
            {preview.structure === "groups_ko" &&
              preview.losersKoSize >= 2 &&
              `, Trostrunde mit ${preview.losersPoolSize} Spielern`}
            {preview.structure === "swiss" && preview.swissByesPerRound > 0 &&
              `, 1 Freilos pro Runde`}
            .
          </div>
        </>
      )}
    </aside>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums text-ink-900">
        {value}
      </div>
    </div>
  );
}
