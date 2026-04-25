import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  categories,
  groupMembers,
  groups,
  matches,
  matchSets,
  participants,
  tournaments,
} from "@/lib/db/schema";
import { ParticipantsPanel } from "@/components/admin/ParticipantsPanel";
import { DrawPanel } from "@/components/admin/DrawPanel";
import { GroupsPanel } from "@/components/admin/GroupsPanel";
import { BracketPanel } from "@/components/admin/BracketPanel";
import { SwissPanel } from "@/components/admin/SwissPanel";
import { CategorySettings } from "@/components/admin/CategorySettings";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { TestPopulatePanel } from "@/components/admin/TestPopulatePanel";
import { PlayerSearchPalette } from "@/components/admin/PlayerSearchPalette";
import { GameResults } from "@/components/public/GameResults";
import {
  buildBracketOrigins,
  computeStandings,
  type EngineGroup,
  type Player,
} from "@/lib/engine";
import {
  isTournamentStructure,
  STRUCTURE_LABELS,
  DRAW_MODE_LABELS,
  isDrawMode,
  type TournamentStructure,
} from "@/lib/engine/format";
import { ArrowLeft, Check } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string; catId: string }>;
}) {
  const { id, catId } = await params;
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, catId), eq(categories.tournamentId, id)))
    .limit(1);
  if (!tournament || !category) notFound();

  const parts = await db
    .select()
    .from(participants)
    .where(eq(participants.categoryId, category.id))
    .orderBy(asc(participants.createdAt));

  const catGroups = await db
    .select()
    .from(groups)
    .where(eq(groups.categoryId, category.id))
    .orderBy(asc(groups.position));

  const members = catGroups.length
    ? await db
        .select()
        .from(groupMembers)
        .where(
          inArray(
            groupMembers.groupId,
            catGroups.map((g) => g.id),
          ),
        )
    : [];

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.categoryId, category.id))
    .orderBy(asc(matches.playOrder));

  const setRows = matchRows.length
    ? await db
        .select()
        .from(matchSets)
        .where(
          inArray(
            matchSets.matchId,
            matchRows.map((m) => m.id),
          ),
        )
        .orderBy(asc(matchSets.setNumber))
    : [];

  const partsById = new Map(parts.map((p) => [p.id, p]));
  const setsByMatch = new Map<string, { a: number; b: number }[]>();
  for (const s of setRows) {
    const arr = setsByMatch.get(s.matchId) ?? [];
    arr.push({ a: s.pointsA, b: s.pointsB });
    setsByMatch.set(s.matchId, arr);
  }

  const engineGroups: EngineGroup[] = catGroups.map((g) => {
    const gMembers = members
      .filter((m) => m.groupId === g.id)
      .sort((a, b) => a.position - b.position);
    const players: Player[] = gMembers.map((m) => ({
      id: m.participantId,
      name: partsById.get(m.participantId)?.name ?? "?",
      club: partsById.get(m.participantId)?.club ?? undefined,
    }));
    const gMatches = matchRows
      .filter((m) => m.stage === "group" && m.groupId === g.id)
      .map((m) => ({
        id: m.id,
        a: m.participantAId,
        b: m.participantBId,
        sets: setsByMatch.get(m.id) ?? [],
      }));
    return { id: g.id, label: g.label, players, matches: gMatches };
  });

  const standings = engineGroups.map(computeStandings);
  const bracketOrigins = buildBracketOrigins(standings);

  const groupMatches = matchRows.filter((m) => m.stage === "group");
  const koMatches = matchRows.filter((m) => m.stage === "ko");
  const losersMatches = matchRows.filter((m) => m.stage === "ko_losers");
  const swissMatches = matchRows.filter((m) => m.stage === "swiss");
  const allGroupComplete =
    groupMatches.length > 0 &&
    groupMatches.every((m) => m.status === "finished");

  const finishedGroupMatches = groupMatches.filter(
    (m) => m.status === "finished",
  ).length;

  const structure: TournamentStructure = isTournamentStructure(
    category.structure,
  )
    ? category.structure
    : "groups_ko";
  const drawMode = isDrawMode(category.drawMode) ? category.drawMode : "random";

  return (
    <div className="space-y-10">
      <div>
        <Link
          href={`/admin/t/${tournament.id}`}
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft size={14} /> {tournament.name}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">
            {category.name}
          </h1>
          {parts.length > 0 && (
            <PlayerSearchPalette participants={parts} />
          )}
        </div>
        <p className="mt-1 text-sm text-ink-500">
          {parts.length} Teilnehmer
          <span className="text-ink-300 mx-1.5">·</span>
          {STRUCTURE_LABELS[structure]}
          <span className="text-ink-300 mx-1.5">·</span>
          Auslosung: {DRAW_MODE_LABELS[drawMode]}
          <span className="text-ink-300 mx-1.5">·</span>
          Best of {category.winSets * 2 - 1}
          <span className="text-ink-300 mx-1.5">·</span>
          Sätze bis {category.setPoints} (+{category.setMinLead})
        </p>
      </div>

      <PublishToggle categoryId={category.id} published={category.published} />

      <CategorySettings
        category={category}
        tournamentId={tournament.id}
        participantCount={parts.length}
        parallelTables={tournament.parallelTables}
        matchDurationMinutes={tournament.matchDurationMinutes}
      />

      <TestPopulatePanel
        category={category}
        participantCount={parts.length}
      />

      {!category.drawDone ? (
        <>
          <Stepper step={1} structure={structure} />
          <ParticipantsPanel categoryId={category.id} participants={parts} />
          <DrawPanel
            categoryId={category.id}
            participantCount={parts.length}
            structure={structure}
          />
        </>
      ) : structure === "swiss" ? (
        <>
          <Stepper step={2} structure={structure} />
          <SwissPanel
            category={category}
            swissMatches={swissMatches}
            sets={setRows}
            participants={parts}
          />
        </>
      ) : structure === "ko_only" ? (
        <>
          <Stepper step={2} structure={structure} />
          <BracketPanel
            tournamentId={tournament.id}
            category={category}
            koMatches={koMatches}
            losersMatches={losersMatches}
            sets={setRows}
            participants={parts}
            origins={bracketOrigins}
            canBuild={false}
          />
        </>
      ) : structure === "round_robin" ? (
        <>
          <Stepper
            step={allGroupComplete ? 3 : 2}
            structure={structure}
            progress={
              groupMatches.length > 0
                ? Math.round((finishedGroupMatches / groupMatches.length) * 100)
                : 0
            }
          />
          <GroupsPanel
            tournamentId={tournament.id}
            category={category}
            groups={catGroups}
            members={members}
            participants={parts}
            matches={groupMatches}
            sets={setRows}
            standings={standings}
          />
        </>
      ) : (
        <>
          <Stepper
            step={allGroupComplete ? 3 : 2}
            structure={structure}
            progress={
              groupMatches.length > 0
                ? Math.round((finishedGroupMatches / groupMatches.length) * 100)
                : 0
            }
          />
          <GroupsPanel
            tournamentId={tournament.id}
            category={category}
            groups={catGroups}
            members={members}
            participants={parts}
            matches={groupMatches}
            sets={setRows}
            standings={standings}
          />
          <BracketPanel
            tournamentId={tournament.id}
            category={category}
            koMatches={koMatches}
            losersMatches={losersMatches}
            sets={setRows}
            participants={parts}
            origins={bracketOrigins}
            canBuild={allGroupComplete}
          />
        </>
      )}

      {category.drawDone && matchRows.length > 0 && (
        <GameResults
          matches={matchRows}
          sets={setRows}
          participants={parts}
          groups={catGroups}
        />
      )}
    </div>
  );
}

function Stepper({
  step,
  structure,
  progress,
}: {
  step: 1 | 2 | 3;
  structure: TournamentStructure;
  progress?: number;
}) {
  const steps =
    structure === "swiss"
      ? [
          { n: 1, label: "Teilnehmer eintragen" },
          { n: 2, label: "Runden spielen" },
          { n: 3, label: "Abschluss" },
        ]
      : structure === "round_robin"
        ? [
            { n: 1, label: "Teilnehmer eintragen" },
            { n: 2, label: "Jeder gegen jeden" },
            { n: 3, label: "Abschluss" },
          ]
        : structure === "round_robin_finals"
          ? [
              { n: 1, label: "Teilnehmer eintragen" },
              { n: 2, label: "Jeder gegen jeden" },
              { n: 3, label: "Finalspiele" },
            ]
          : structure === "ko_only"
            ? [
                { n: 1, label: "Teilnehmer eintragen" },
                { n: 2, label: "Finalbaum" },
                { n: 3, label: "Abschluss" },
              ]
            : [
                { n: 1, label: "Teilnehmer eintragen" },
                { n: 2, label: "Gruppenphase" },
                { n: 3, label: "Finalrunde" },
              ];
  return (
    <div className="card p-4">
      <ol className="flex items-center gap-3 sm:gap-6 overflow-x-auto py-1 -my-1">
        {steps.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li key={s.n} className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-brand-600 text-white"
                    : active
                      ? "bg-brand-50 text-brand-700 ring-2 ring-inset ring-brand-600"
                      : "bg-ink-100 text-ink-400"
                }`}
              >
                {done ? <Check size={14} /> : s.n}
              </div>
              <span
                className={`text-sm whitespace-nowrap ${
                  active
                    ? "font-semibold text-ink-900"
                    : done
                      ? "text-ink-600"
                      : "text-ink-400"
                }`}
              >
                {s.label}
                {active && s.n === 2 && typeof progress === "number" && (
                  <span className="ml-2 text-xs text-ink-400 font-normal">
                    {progress}%
                  </span>
                )}
              </span>
              {i < steps.length - 1 && (
                <span className="text-ink-300 hidden sm:inline">―</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
