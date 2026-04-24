"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "@/components/Icon";
import { ChipGroup } from "@/components/admin/ChipGroup";
import {
  DRAW_MODES,
  DRAW_MODE_LABELS,
  TOURNAMENT_STRUCTURES,
  STRUCTURE_LABELS,
  type DrawMode,
  type TournamentStructure,
} from "@/lib/engine/format";

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

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
    "Klassisch: Gruppenphase (jede:r gegen jede:n), danach KO-Finalbaum.",
  round_robin: "Alle spielen gegen alle. Eine einzige Rangliste, kein KO.",
  round_robin_finals:
    "Alle spielen gegen alle. Anschließend spielen Platz 1 vs. 2 um den Titel und Platz 3 vs. 4 um Bronze.",
  ko_only:
    "Direkter KO-Baum aus der Setzliste. Keine Gruppen, keine zweite Chance.",
  swiss:
    "Feste Rundenzahl, gepaart nach Punktgleichstand. Geeignet für viele Teilnehmer an kurzem Tag.",
};

const DRAW_MODE_DESCRIPTIONS: Record<DrawMode, string> = {
  random: "Rein zufällig, optional deterministisch per Seed.",
  seeded_snake:
    "Spieler werden nach Setzposition im Schlangenverfahren verteilt. Top-Gesetzte landen in verschiedenen Gruppen.",
  paste_order:
    "Reihenfolge wie eingegeben: die ersten Spieler in Gruppe A, die nächsten in B, usw. Ohne Mischen oder Schlange.",
  manual: "Du ziehst jeden Spieler selbst in eine Gruppe oder einen Platz.",
};

export function CreateCategoryForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [structure, setStructure] = useState<TournamentStructure>("groups_ko");
  const [drawMode, setDrawMode] = useState<DrawMode>("random");
  const [groupSize, setGroupSize] = useState(4);
  const [swissRounds, setSwissRounds] = useState(5);
  const [winSets, setWinSets] = useState(2);
  const [setPoints, setSetPoints] = useState(11);
  const [setMinLead, setSetMinLead] = useState(2);
  const [luckyLoserEnabled, setLuckyLoserEnabled] = useState(true);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        className="btn-secondary inline-flex items-center gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} /> Spielklasse hinzufügen
      </button>
    );
  }

  const showGroupSize =
    structure === "groups_ko" ||
    structure === "round_robin" ||
    structure === "round_robin_finals";
  const showSwissRounds = structure === "swiss";
  const showLuckyLoser = structure === "groups_ko";

  return (
    <form
      className="card p-5 space-y-5 max-w-2xl"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          const res = await fetch(
            `/api/tournaments/${tournamentId}/categories`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name,
                slug: slug || toSlug(name),
                structure,
                drawMode,
                groupSize,
                swissRounds,
                winSets,
                setPoints,
                setMinLead,
                luckyLoserEnabled,
                published,
              }),
            },
          );
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? "Speichern hat nicht geklappt.");
            return;
          }
          router.refresh();
          setOpen(false);
          setName("");
          setSlug("");
          setSlugEdited(false);
          setStructure("groups_ko");
          setDrawMode("random");
          setGroupSize(4);
          setSwissRounds(5);
          setWinSets(2);
          setSetPoints(11);
          setSetMinLead(2);
          setLuckyLoserEnabled(true);
          setPublished(false);
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3 className="font-semibold tracking-tight">Neue Spielklasse</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input
            className="input"
            placeholder="z.B. Herren, Damen, Jugend U18"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(toSlug(e.target.value));
            }}
            required
            autoFocus
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">URL-Kürzel</label>
          <input
            className="input font-mono"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            pattern="[a-z0-9-]+"
            required
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Wird in der öffentlichen URL verwendet - nur Kleinbuchstaben, Zahlen
            und Bindestriche.
          </p>
        </div>
      </div>

      <div>
        <label className="label">Struktur</label>
        <ChipGroup
          options={TOURNAMENT_STRUCTURES.map((s) => ({
            value: s,
            label: STRUCTURE_LABELS[s],
          }))}
          value={structure}
          onChange={(v) => setStructure(v)}
        />
        <p className="mt-1.5 text-xs text-ink-500">
          {STRUCTURE_DESCRIPTIONS[structure]}
        </p>
      </div>

      <div>
        <label className="label">Auslosung</label>
        <ChipGroup
          options={DRAW_MODES.filter((m) => m !== "manual").map((m) => ({
            value: m,
            label: DRAW_MODE_LABELS[m],
          }))}
          value={drawMode === "manual" ? "random" : drawMode}
          onChange={(v) => setDrawMode(v)}
        />
        <p className="mt-1.5 text-xs text-ink-500">
          {DRAW_MODE_DESCRIPTIONS[drawMode]}
        </p>
      </div>

      {showGroupSize && (
        <div>
          <label className="label">
            {structure === "round_robin" ||
            structure === "round_robin_finals"
              ? "Gruppengröße (Referenz)"
              : "Spieler pro Gruppe"}
          </label>
          <ChipGroup
            options={GROUP_SIZE_OPTIONS.map((n) => ({
              value: n,
              label: String(n),
            }))}
            value={groupSize}
            onChange={setGroupSize}
          />
          <p className="mt-1.5 text-xs text-ink-500">
            3 bis 8 Spieler. Bei knapper Teilnehmerzahl werden Gruppen leicht
            vergrößert oder verkleinert.
          </p>
        </div>
      )}

      {showSwissRounds && (
        <div>
          <label className="label">Runden</label>
          <ChipGroup
            options={SWISS_ROUND_CHIPS.map((n) => ({
              value: n,
              label: String(n),
            }))}
            value={swissRounds}
            onChange={setSwissRounds}
            allowCustom
            customMin={1}
            customMax={15}
            customLabel="Andere"
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Richtwert: ceil(log₂(N)), mindestens 3.
          </p>
        </div>
      )}

      <div>
        <label className="label">Spielmodus</label>
        <ChipGroup
          options={WIN_SETS_OPTIONS}
          value={winSets}
          onChange={setWinSets}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Satz-Punkte</label>
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
          <p className="mt-1.5 text-xs text-ink-500">
            Standard: 11. Schulturnier z.B. 15 oder 21.
          </p>
        </div>
        <div>
          <label className="label">Mindestvorsprung</label>
          <ChipGroup
            options={LEAD_CHIPS.map((n) => ({ value: n, label: `+${n}` }))}
            value={setMinLead}
            onChange={setSetMinLead}
            allowCustom
            customMin={1}
            customMax={10}
            customLabel="Andere"
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Standard: 2 (Einstand-Regel ab 10:10).
          </p>
        </div>
      </div>

      {showLuckyLoser && (
        <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-ink-200 bg-surface p-3 hover:border-brand-300 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={luckyLoserEnabled}
            onChange={(e) => setLuckyLoserEnabled(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">Lucky Loser zulassen</span>
            <span className="block text-xs text-ink-500 mt-0.5">
              Passt die Anzahl der Qualifizierten nicht sauber auf eine Zweierpotenz,
              rücken die besten Gruppendritten in den Finalbaum nach. Ohne Lucky
              Loser bleiben die fehlenden Plätze offen - die Topgesetzten
              erhalten dann ein Freilos und ziehen kampflos in die nächste Runde.
            </span>
          </span>
        </label>
      )}

      <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-ink-200 bg-surface p-3 hover:border-brand-300 transition-colors">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        <span className="text-sm">
          <span className="font-medium">Sofort veröffentlichen</span>
          <span className="block text-xs text-ink-500 mt-0.5">
            Nur veröffentlichte Klassen erscheinen auf der öffentlichen
            Turnierseite. Standardmäßig wird als Entwurf gespeichert; du
            kannst später auf der Klassenseite freischalten.
          </span>
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
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
          {saving ? "Speichern..." : "Anlegen"}
        </button>
      </div>
    </form>
  );
}
