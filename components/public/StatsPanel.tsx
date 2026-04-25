import type { Participant } from "@/lib/db/schema";
import type {
  MatchHighlight,
  PlayerStat,
  SetHighlight,
  TournamentStats,
} from "@/lib/engine/tournamentStats";
import { topBy } from "@/lib/engine/tournamentStats";
import { Trophy, Sparkles, Users, Clock, Radio, Sun } from "@/components/Icon";

type Props = {
  stats: TournamentStats;
  participants: Participant[];
  /** Heading variant. Admin gets a slightly less ornate intro. */
  variant?: "public" | "admin";
};

type Tone = "amber" | "brand" | "emerald" | "ink";

export function StatsPanel({ stats, participants, variant = "public" }: Props) {
  if (stats.finishedMatches === 0) return null;

  const partsById = new Map(participants.map((p) => [p.id, p]));
  const name = (id: string) => partsById.get(id)?.name ?? "?";

  const podiums: Array<{
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    entries: ReturnType<typeof topBy>;
    format: (v: number, p: PlayerStat) => string;
  }> = [
    {
      icon: <Trophy size={16} />,
      title: "Meiste Siege",
      entries: topBy(stats.perPlayer, (s) => s.wins),
      format: (v, p) => `${v}-${p.losses}`,
    },
    {
      icon: <Sparkles size={16} />,
      title: "Beste Siegquote",
      subtitle: "ab 2 Spielen",
      entries: topBy(stats.perPlayer, (s) => s.winRate, 3, { minMatches: 2 }),
      format: (v, p) => `${Math.round(v * 100)}% (${p.wins}-${p.losses})`,
    },
    {
      icon: <Sun size={16} />,
      title: "Meiste Punkte",
      entries: topBy(stats.perPlayer, (s) => s.pointsWon),
      format: (v) => `${v}`,
    },
    {
      icon: <Radio size={16} />,
      title: "Beste Punkte-Differenz",
      entries: topBy(stats.perPlayer, (s) => s.pointDiff, 3, {
        allowZero: true,
      }),
      format: (v) => (v > 0 ? `+${v}` : `${v}`),
    },
    {
      icon: <Trophy size={16} />,
      title: "Glatte Siege",
      subtitle: "ohne Satzverlust",
      entries: topBy(stats.perPlayer, (s) => s.cleanSweeps),
      format: (v) => `${v}`,
    },
    {
      icon: <Sparkles size={16} />,
      title: "Aufholjagden",
      subtitle: "Sieg nach 0:1",
      entries: topBy(stats.perPlayer, (s) => s.comebacks),
      format: (v) => `${v}`,
    },
  ];

  const summaryCards = [
    {
      label: "Spiele",
      value: `${stats.finishedMatches}`,
      hint:
        stats.totalMatches > stats.finishedMatches
          ? `von ${stats.totalMatches}`
          : "alle gespielt",
    },
    {
      label: "Sätze",
      value: `${stats.totalSetsPlayed}`,
      hint: `Ø ${stats.averagePointsPerSet.toFixed(1)} Pkt/Satz`,
    },
    {
      label: "Punkte",
      value: `${stats.totalPointsPlayed}`,
      hint: "über alle Sätze",
    },
    {
      label: "Krimi-Sätze",
      value: `${stats.deuceSetsCount}`,
      hint:
        stats.bagelSetsCount > 0
          ? `${stats.bagelSetsCount}× zu Null`
          : "Verlängerung",
    },
  ];

  return (
    <section className="space-y-5" aria-label="Statistiken">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles size={20} className="text-brand-600" />
          Statistiken
        </h2>
        {variant === "admin" && (
          <span className="text-xs text-ink-500">
            Live-Auswertung über alle Phasen
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
              {c.label}
            </div>
            <div className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums text-ink-900">
              {c.value}
            </div>
            <div className="text-[11px] text-ink-500">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {podiums.map((p) => (
          <Podium
            key={p.title}
            icon={p.icon}
            title={p.title}
            subtitle={p.subtitle}
            entries={p.entries}
            format={p.format}
            name={name}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {stats.closestMatch && (
          <HighlightCard
            tone="brand"
            title="Knappstes Spiel"
            subtitle={`Nur ${stats.closestMatch.pointMargin} Punkt${
              stats.closestMatch.pointMargin === 1 ? "" : "e"
            } Unterschied`}
            highlight={stats.closestMatch}
            name={name}
          />
        )}
        {stats.biggestBlowout && (
          <HighlightCard
            tone="amber"
            title="Höchster Sieg"
            subtitle={`${stats.biggestBlowout.pointMargin} Punkte Vorsprung`}
            highlight={stats.biggestBlowout}
            name={name}
          />
        )}
        {stats.longestMatch && (
          <HighlightCard
            tone="ink"
            icon={<Clock size={12} />}
            title="Längstes Spiel"
            subtitle={`${stats.longestMatch.totalPoints} Punkte insgesamt`}
            highlight={stats.longestMatch}
            name={name}
          />
        )}
        {stats.longestSet && (
          <SetHighlightCard highlight={stats.longestSet} name={name} />
        )}
      </div>
    </section>
  );
}

function Podium({
  icon,
  title,
  subtitle,
  entries,
  format,
  name,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  entries: ReturnType<typeof topBy>;
  format: (v: number, p: PlayerStat) => string;
  name: (id: string) => string;
}) {
  const rankClasses = [
    "bg-amber-400 text-white",
    "bg-ink-300 text-ink-900",
    "bg-amber-700 text-white",
  ];
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-brand-600 shrink-0">{icon}</span>
          <h3 className="font-semibold text-sm tracking-tight truncate">
            {title}
          </h3>
        </div>
        {subtitle && (
          <span className="text-[10px] uppercase tracking-wider text-ink-400 shrink-0">
            {subtitle}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <div className="px-4 py-4 text-xs text-ink-400">Noch keine Daten.</div>
      ) : (
        <ol className="divide-y divide-ink-100">
          {entries.map((e, i) => (
            <li
              key={e.player.participantId}
              className="flex items-center gap-3 px-4 py-2"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${
                  rankClasses[i] ?? "bg-ink-100 text-ink-500"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-medium text-sm truncate flex-1 text-ink-900">
                {name(e.player.participantId)}
              </span>
              <span className="font-mono tabular-nums text-sm text-ink-700 shrink-0">
                {format(e.value, e.player)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const TONE_CLASSES: Record<Tone, string> = {
  amber: "stats-highlight stats-highlight-amber",
  brand: "stats-highlight stats-highlight-brand",
  emerald: "stats-highlight stats-highlight-emerald",
  ink: "stats-highlight stats-highlight-ink",
};

function HighlightCard({
  tone,
  icon,
  title,
  subtitle,
  highlight,
  name,
}: {
  tone: Tone;
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  highlight: MatchHighlight;
  name: (id: string) => string;
}) {
  const aWon = highlight.pointsA > highlight.pointsB;
  return (
    <div className={`rounded-xl border p-4 shadow-soft ${TONE_CLASSES[tone]}`}>
      <div className="stats-highlight-label flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
        {icon}
        {title}
      </div>
      <div className="stats-highlight-sub mt-1 text-xs">{subtitle}</div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm font-semibold ${
              aWon ? "" : "opacity-60"
            }`}
          >
            {name(highlight.participantAId)}
          </div>
          <div
            className={`truncate text-sm font-semibold ${
              aWon ? "opacity-60" : ""
            }`}
          >
            {name(highlight.participantBId)}
          </div>
        </div>
        <div className="text-right tabular-nums font-mono shrink-0">
          <div className="text-lg font-bold">
            {highlight.setsA}:{highlight.setsB}
          </div>
          <div className="stats-highlight-sub text-xs">
            {highlight.pointsA}:{highlight.pointsB} Pkt
          </div>
        </div>
      </div>
    </div>
  );
}

function SetHighlightCard({
  highlight,
  name,
}: {
  highlight: SetHighlight;
  name: (id: string) => string;
}) {
  const aWon = highlight.winnerSide === "A";
  return (
    <div
      className={`rounded-xl border p-4 shadow-soft ${TONE_CLASSES.emerald}`}
    >
      <div className="stats-highlight-label flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
        <Users size={14} />
        Längster Satz
      </div>
      <div className="stats-highlight-sub mt-1 text-xs">
        {highlight.totalPoints} Punkte · Satz {highlight.setNumber}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm font-semibold ${
              aWon ? "" : "opacity-60"
            }`}
          >
            {name(highlight.participantAId)}
          </div>
          <div
            className={`truncate text-sm font-semibold ${
              aWon ? "opacity-60" : ""
            }`}
          >
            {name(highlight.participantBId)}
          </div>
        </div>
        <div className="text-right tabular-nums font-mono shrink-0">
          <div className="text-lg font-bold">
            {highlight.pointsA}:{highlight.pointsB}
          </div>
        </div>
      </div>
    </div>
  );
}
