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
import { computeStandings, type EngineGroup, type Player } from "@/lib/engine";

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

  // Build engine groups → standings
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

  const groupMatches = matchRows.filter((m) => m.stage === "group");
  const koMatches = matchRows.filter((m) => m.stage === "ko");
  const allGroupComplete =
    groupMatches.length > 0 &&
    groupMatches.every((m) => m.status === "finished");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/t/${tournament.id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {tournament.name}
        </Link>
        <h1 className="text-2xl font-bold mt-1">{category.name}</h1>
        <p className="text-sm text-slate-500">
          {parts.length} Teilnehmer • Gruppen à {category.groupSize} • Best of{" "}
          {category.winSets * 2 - 1}
        </p>
      </div>

      {!category.drawDone ? (
        <>
          <ParticipantsPanel categoryId={category.id} participants={parts} />
          <DrawPanel
            categoryId={category.id}
            participantCount={parts.length}
          />
        </>
      ) : (
        <>
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
            sets={setRows}
            participants={parts}
            canBuild={allGroupComplete}
          />
        </>
      )}
    </div>
  );
}
