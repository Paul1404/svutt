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
import { computeStandings, type EngineGroup, type Player } from "@/lib/engine";
import { AutoRefresh } from "@/components/public/AutoRefresh";
import { PublicGroupView } from "@/components/public/PublicGroupView";
import { PublicBracket } from "@/components/public/PublicBracket";
import { ArrowLeft } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; category: string }>;
}) {
  const { slug, category: catSlug } = await params;
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);
  if (!tournament) notFound();

  const [category] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.tournamentId, tournament.id),
        eq(categories.slug, catSlug),
      ),
    )
    .limit(1);
  if (!category) notFound();

  const parts = await db
    .select()
    .from(participants)
    .where(eq(participants.categoryId, category.id));

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

  const groupMatches = matchRows.filter((m) => m.stage === "group");
  const koMatches = matchRows.filter((m) => m.stage === "ko");

  return (
    <div className="min-h-screen bg-white">
      <AutoRefresh intervalSeconds={30} />
      <header className="sticky top-0 z-10 border-b border-brand-800/20 bg-brand-700 text-white shadow-pop">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Link
            href={`/t/${tournament.slug}`}
            className="inline-flex items-center gap-1 text-sm text-brand-100 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> {tournament.name}
          </Link>
          <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight">
            {category.name}
          </h1>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 space-y-10">
        {!category.drawDone ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-white p-10 text-center">
            <p className="text-sm text-ink-600">Losung steht noch aus.</p>
          </div>
        ) : (
          <>
            <PublicGroupView
              groups={catGroups}
              members={members}
              participants={parts}
              matches={groupMatches}
              sets={setRows}
              standings={standings}
            />
            {koMatches.length > 0 && (
              <PublicBracket
                koMatches={koMatches}
                sets={setRows}
                participants={parts}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-ink-100 py-6">
        <div className="mx-auto max-w-5xl px-4 text-xs text-ink-400">
          <a
            href="https://sv-untereuerheim.de"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-600 transition-colors"
          >
            SV 1945 Untereuerheim e.V.
          </a>
        </div>
      </footer>
    </div>
  );
}
