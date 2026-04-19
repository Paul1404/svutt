"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Hourglass,
  MapPin,
  Plus,
  Sparkles,
  Trophy,
  X,
} from "@/components/Icon";

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

type StepKey = "name" | "schedule" | "tables" | "review";

const STEPS: { key: StepKey; title: string; subtitle: string }[] = [
  { key: "name", title: "Turnier", subtitle: "Name und URL" },
  { key: "schedule", title: "Wann & Wo", subtitle: "Datum, Zeit, Ort" },
  { key: "tables", title: "Ablauf", subtitle: "Tische und Spieldauer" },
  { key: "review", title: "Übersicht", subtitle: "Kurz prüfen" },
];

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function CreateTournamentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [parallelTables, setParallelTables] = useState(3);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(11);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIdx]!;
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  const trimmedName = name.trim();
  const effectiveSlug = (slug || toSlug(trimmedName)).trim();
  const slugLooksValid = /^[a-z0-9-]{2,64}$/.test(effectiveSlug);

  function reset() {
    setStepIdx(0);
    setName("");
    setSlug("");
    setSlugEdited(false);
    setLocation("");
    setStartDate("");
    setStartTime("10:00");
    setParallelTables(3);
    setMatchDurationMinutes(11);
    setError(null);
    setSaving(false);
  }

  function close() {
    setOpen(false);
    // defer reset so closing animation can read state
    setTimeout(reset, 0);
  }

  // Keyboard: Escape to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, saving]);

  // Focus first input on each step.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      el?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [stepIdx, open]);

  function stepIsValid(idx: number): boolean {
    if (idx === 0) return trimmedName.length >= 2 && slugLooksValid;
    if (idx === 1) return /^\d{1,2}:\d{2}$/.test(startTime);
    if (idx === 2) {
      return (
        parallelTables >= 1 &&
        parallelTables <= 32 &&
        matchDurationMinutes >= 1 &&
        matchDurationMinutes <= 120
      );
    }
    return true;
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const startDateIso = startDate
        ? new Date(`${startDate}T${startTime || "10:00"}:00`).toISOString()
        : undefined;
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: effectiveSlug,
          location: location.trim() || undefined,
          startDate: startDateIso,
          startTime,
          parallelTables,
          matchDurationMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Speichern hat nicht geklappt.");
        // jump back to the first invalid step on error
        if (data.error?.toLowerCase?.().includes("slug")) setStepIdx(0);
        return;
      }
      setOpen(false);
      router.push(`/admin/t/${data.tournament.id}`);
      router.refresh();
    } catch {
      setError("Keine Verbindung. Bitte nochmal versuchen.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        className="btn-primary inline-flex items-center gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus size={16} /> Neues Turnier
      </button>
    );
  }

  return (
    <div
      className="dialog-overlay fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) close();
      }}
    >
      <div
        ref={dialogRef}
        className="card w-full max-w-2xl shadow-pop flex flex-col sm:my-auto"
      >
        <header className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Trophy size={20} />
            </span>
            <div>
              <h2 id="wizard-title" className="text-xl font-semibold tracking-tight">
                Neues Turnier
              </h2>
              <p className="text-sm text-ink-500">
                Schritt {stepIdx + 1} von {STEPS.length} ·{" "}
                <span className="text-ink-700 font-medium">{step.title}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Schließen"
            className="btn-ghost h-9 w-9 px-0 py-0"
            onClick={close}
            disabled={saving}
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-6">
          <StepIndicator
            current={stepIdx}
            onJump={(i) => {
              // only allow jumping back to completed steps
              if (i < stepIdx) setStepIdx(i);
            }}
          />
        </div>

        <form
          className="flex-1 px-6 pt-5 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!stepIsValid(stepIdx)) return;
            if (isLast) {
              submit();
            } else {
              setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
            }
          }}
        >
          <div className="min-h-[280px]">
            {step.key === "name" && (
              <NameStep
                name={name}
                setName={(v) => {
                  setName(v);
                  if (!slugEdited) setSlug(toSlug(v));
                }}
                slug={slug || toSlug(trimmedName)}
                setSlug={(v) => {
                  setSlug(v);
                  setSlugEdited(true);
                }}
                slugLooksValid={slugLooksValid}
              />
            )}
            {step.key === "schedule" && (
              <ScheduleStep
                location={location}
                setLocation={setLocation}
                startDate={startDate}
                setStartDate={setStartDate}
                startTime={startTime}
                setStartTime={setStartTime}
              />
            )}
            {step.key === "tables" && (
              <TablesStep
                parallelTables={parallelTables}
                setParallelTables={setParallelTables}
                matchDurationMinutes={matchDurationMinutes}
                setMatchDurationMinutes={setMatchDurationMinutes}
              />
            )}
            {step.key === "review" && (
              <ReviewStep
                name={trimmedName}
                slug={effectiveSlug}
                location={location.trim()}
                startDate={startDate}
                startTime={startTime}
                parallelTables={parallelTables}
                matchDurationMinutes={matchDurationMinutes}
              />
            )}
          </div>

          {error && (
            <div
              className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-ink-200/80 pt-4">
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-40"
              onClick={() => (isFirst ? close() : setStepIdx((i) => i - 1))}
              disabled={saving}
            >
              {isFirst ? (
                "Abbrechen"
              ) : (
                <>
                  <ArrowLeft size={14} /> Zurück
                </>
              )}
            </button>
            <div className="text-xs text-ink-400 hidden sm:block">
              <kbd className="kbd">Enter</kbd>{" "}
              {isLast ? "erstellt das Turnier" : "für weiter"}
            </div>
            <button
              type="submit"
              className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
              disabled={saving || !stepIsValid(stepIdx)}
            >
              {isLast ? (
                saving ? (
                  "Wird angelegt..."
                ) : (
                  <>
                    <Check size={14} /> Turnier anlegen
                  </>
                )
              ) : (
                <>
                  Weiter <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StepIndicator({
  current,
  onJump,
}: {
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Fortschritt">
      {STEPS.map((s, i) => {
        const state =
          i < current ? "done" : i === current ? "current" : "upcoming";
        const clickable = i < current;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              className="wizard-step-dot shrink-0 disabled:cursor-default"
              data-state={state}
              onClick={() => onJump(i)}
              disabled={!clickable}
              aria-current={state === "current" ? "step" : undefined}
              title={s.title}
            >
              {state === "done" ? <Check size={12} /> : i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <span
                className="wizard-step-line"
                data-state={i < current ? "done" : "upcoming"}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeader({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 text-brand-600">
        {icon}
        <h3 className="text-lg font-semibold tracking-tight text-ink-900">
          {title}
        </h3>
      </div>
      <p className="mt-1 text-sm text-ink-500">{hint}</p>
    </div>
  );
}

function NameStep({
  name,
  setName,
  slug,
  setSlug,
  slugLooksValid,
}: {
  name: string;
  setName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  slugLooksValid: boolean;
}) {
  return (
    <div>
      <StepHeader
        icon={<Sparkles size={18} />}
        title="Wie heißt dein Turnier?"
        hint="Der Name taucht in der öffentlichen Ansicht und in Überschriften auf."
      />
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="wiz-name">
            Turniername
          </label>
          <input
            id="wiz-name"
            className="input"
            placeholder="z.B. Sommer-Open 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="label" htmlFor="wiz-slug">
            Kürzel für die URL
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 font-mono pointer-events-none">
              /t/
            </span>
            <input
              id="wiz-slug"
              className="input pl-10 font-mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="[a-z0-9-]{2,64}"
              required
              maxLength={64}
              spellCheck={false}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            Nur Kleinbuchstaben, Zahlen und Bindestriche.{" "}
            {slug && !slugLooksValid && (
              <span className="text-brand-600">
                Mindestens 2 Zeichen, keine Sonderzeichen.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScheduleStep({
  location,
  setLocation,
  startDate,
  setStartDate,
  startTime,
  setStartTime,
}: {
  location: string;
  setLocation: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
}) {
  return (
    <div>
      <StepHeader
        icon={<Calendar size={18} />}
        title="Wann und wo findet es statt?"
        hint="Datum und Ort sind optional – du kannst beides später ändern."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="wiz-date">
            Datum
          </label>
          <input
            id="wiz-date"
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="wiz-time">
            Erste Startzeit
          </label>
          <input
            id="wiz-time"
            className="input"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="wiz-loc">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} /> Ort
            </span>
          </label>
          <input
            id="wiz-loc"
            className="input"
            placeholder="Sporthalle Musterstadt"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
          />
        </div>
      </div>
    </div>
  );
}

function TablesStep({
  parallelTables,
  setParallelTables,
  matchDurationMinutes,
  setMatchDurationMinutes,
}: {
  parallelTables: number;
  setParallelTables: (v: number) => void;
  matchDurationMinutes: number;
  setMatchDurationMinutes: (v: number) => void;
}) {
  return (
    <div>
      <StepHeader
        icon={<Hourglass size={18} />}
        title="Wie schnell soll gespielt werden?"
        hint="Daraus ergibt sich der Spielplan und die Startzeit pro Tisch."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="wiz-tables">
            Tische gleichzeitig
          </label>
          <input
            id="wiz-tables"
            className="input"
            type="number"
            min={1}
            max={32}
            value={Number.isFinite(parallelTables) ? parallelTables : ""}
            onChange={(e) =>
              setParallelTables(clampInt(parseInt(e.target.value, 10), 1, 32, 1))
            }
            onBlur={(e) =>
              setParallelTables(clampInt(parseInt(e.target.value, 10), 1, 32, 3))
            }
            required
          />
          <p className="mt-1.5 text-xs text-ink-500">1 bis 32 Tische parallel.</p>
        </div>
        <div>
          <label className="label" htmlFor="wiz-dur">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} /> Spiel dauert etwa (Minuten)
            </span>
          </label>
          <input
            id="wiz-dur"
            className="input"
            type="number"
            min={1}
            max={120}
            value={
              Number.isFinite(matchDurationMinutes) ? matchDurationMinutes : ""
            }
            onChange={(e) =>
              setMatchDurationMinutes(
                clampInt(parseInt(e.target.value, 10), 1, 120, 1),
              )
            }
            onBlur={(e) =>
              setMatchDurationMinutes(
                clampInt(parseInt(e.target.value, 10), 1, 120, 11),
              )
            }
            required
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Faustregel inkl. Pause: 11 Min für Best of 3, 18 Min für Best of 5.
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-ink-200 bg-surface-2/60 p-4 text-sm text-ink-600">
        <div className="font-medium text-ink-700">Tipp</div>
        <p className="mt-1">
          Diese Werte gelten für das gesamte Turnier. Je Spielklasse legst du
          später Gruppengröße und Satzmodus (Best of 3 / 5) fest.
        </p>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-200/70 py-2.5 last:border-0">
      <span className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </span>
      <span className="text-sm text-ink-900 text-right font-medium">
        {value || (
          <span className="text-ink-400 italic font-normal">
            {placeholder ?? "—"}
          </span>
        )}
      </span>
    </div>
  );
}

function ReviewStep({
  name,
  slug,
  location,
  startDate,
  startTime,
  parallelTables,
  matchDurationMinutes,
}: {
  name: string;
  slug: string;
  location: string;
  startDate: string;
  startTime: string;
  parallelTables: number;
  matchDurationMinutes: number;
}) {
  const date = startDate
    ? new Date(`${startDate}T00:00:00`).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  return (
    <div>
      <StepHeader
        icon={<Check size={18} />}
        title="Passt alles?"
        hint="Du kannst jede Einstellung später im Turnier noch anpassen."
      />
      <div className="rounded-xl border border-ink-200 bg-surface-2/60 px-4">
        <ReviewRow label="Name" value={name} />
        <ReviewRow label="URL" value={`/t/${slug}`} />
        <ReviewRow label="Datum" value={date} placeholder="— (optional)" />
        <ReviewRow label="Startzeit" value={`${startTime} Uhr`} />
        <ReviewRow label="Ort" value={location} placeholder="— (optional)" />
        <ReviewRow label="Tische parallel" value={String(parallelTables)} />
        <ReviewRow
          label="Spieldauer"
          value={`${matchDurationMinutes} Min`}
        />
      </div>
      <p className="mt-4 text-xs text-ink-500">
        Nach dem Anlegen landest du direkt auf der Turnier-Seite, wo du
        Spielklassen (Herren, Damen, Jugend …) und Teilnehmer hinzufügen kannst.
      </p>
    </div>
  );
}
