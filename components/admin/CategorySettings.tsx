"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Category } from "@/lib/db/schema";
import { AlertTriangle, Settings, Sparkles, Trash, Users } from "@/components/Icon";
import { HelpTooltip } from "@/components/Tooltip";
import { useToast } from "@/components/Toast";
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
  const [luckyLoserEnabled, setLuckyLoserEnabled] = useState(
    category.luckyLoserEnabled,
  );
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
        matchDurationMinutes,
        parallelTables,
      }),
    [
      participantCount,
      groupSize,
      luckyLoserEnabled,
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

  if (!open) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat label="Gruppen à" value={String(category.groupSize)} />
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
            <Stat
              label="Lucky Loser"
              value={category.luckyLoserEnabled ? "an" : "aus"}
            />
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
                    }),
                setPoints,
                setMinLead,
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
                <span className="label mb-0">Spieler pro Gruppe</span>
                <HelpTooltip label="Spieler pro Gruppe">
                  Jede:r spielt in der Gruppe gegen alle anderen. 4 ist klassisch
                  (6 Spiele pro Gruppe). Bei ungerader Teilnehmerzahl verteilen
                  wir die Überhänge automatisch, damit keine winzige Gruppe
                  entsteht.
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
              {showSuggestion && (
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

            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-ink-200 bg-white p-3 hover:border-brand-300 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={luckyLoserEnabled}
                onChange={(e) => setLuckyLoserEnabled(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium inline-flex items-center gap-1">
                  Lucky Loser zulassen
                  <HelpTooltip label="Lucky Loser">
                    Wenn die Gruppenanzahl keine Zweierpotenz ist (z.B. 3, 5, 6
                    Gruppen), rücken die besten Gruppendritten ins KO nach.
                    Alternative: leere Plätze als Freilos — die Gesetzten ziehen
                    kampflos weiter.
                  </HelpTooltip>
                </span>
                <span className="block text-xs text-ink-500 mt-0.5">
                  Fülle Freilose mit den besten Dritten, statt kampflose Runden
                  zuzulassen.
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

type ChipOption<T extends number> = { value: T; label: string };

function ChipGroup<T extends number>({
  options,
  value,
  onChange,
  disabled,
  allowCustom,
  customMin,
  customMax,
  customLabel,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  allowCustom?: boolean;
  customMin?: number;
  customMax?: number;
  customLabel?: string;
}) {
  const isCustom = allowCustom && !options.some((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      className="flex flex-wrap gap-1.5 items-center"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      {allowCustom && (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2 py-1">
          <span className="text-xs text-ink-500">
            {customLabel ?? "Andere"}:
          </span>
          <input
            type="number"
            min={customMin}
            max={customMax}
            disabled={disabled}
            value={isCustom ? value : ""}
            placeholder="—"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onChange(n as T);
            }}
            className="w-14 bg-transparent text-sm font-semibold tabular-nums outline-none disabled:opacity-50"
          />
        </div>
      )}
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
          Füge Teilnehmer hinzu, dann siehst du hier die Gruppen­aufteilung, die
          Runden im KO und eine Zeit­schätzung.
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
            <PreviewStat
              label="Gruppen­spiele"
              value={String(preview.groupMatches)}
            />
            <PreviewStat
              label="KO-Spiele"
              value={preview.hasKO ? String(preview.koMatches) : "—"}
            />
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
            {preview.luckyLoserSlots > 0 &&
              `, ${preview.luckyLoserSlots} Lucky-Loser-Plätze`}
            {preview.hasKO &&
              preview.luckyLoserSlots === 0 &&
              preview.koSize > preview.groupCount &&
              !luckyLoserEnabled &&
              `, ${preview.koSize - preview.groupCount} Freilose`}
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
