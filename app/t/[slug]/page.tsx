import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, asc, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, matches, tournaments } from "@/lib/db/schema";
import { ArrowLeft, ArrowRight, Calendar, MapPin } from "@/components/Icon";
import { ClubMark } from "@/components/ClubMark";
import { categoryStatus } from "@/lib/tournamentStatus";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);
  if (!tournament) notFound();

  const cats = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.tournamentId, tournament.id),
        eq(categories.published, true),
      ),
    )
    .orderBy(asc(categories.sortOrder));

  const catMatchRows = cats.length
    ? await db
        .select({
          categoryId: matches.categoryId,
          status: matches.status,
          participantAId: matches.participantAId,
          participantBId: matches.participantBId,
        })
        .from(matches)
        .where(
          inArray(
            matches.categoryId,
            cats.map((c) => c.id),
          ),
        )
    : [];

  const countsByCat = new Map<
    string,
    { totalPlayable: number; pendingPlayable: number }
  >();
  for (const m of catMatchRows) {
    if (m.participantAId === null || m.participantBId === null) continue;
    const c = countsByCat.get(m.categoryId) ?? {
      totalPlayable: 0,
      pendingPlayable: 0,
    };
    c.totalPlayable++;
    if (m.status !== "finished") c.pendingPlayable++;
    countsByCat.set(m.categoryId, c);
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 80% at 100% 0%, rgba(255,255,255,0.18) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-brand-100 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Alle Turniere
            </Link>
            <ClubMark size="sm" showLabel={false} />
          </div>
          <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-200/90">
            Turnier
          </div>
          <h1 className="mt-1 text-3xl sm:text-5xl font-bold tracking-tight">
            {tournament.name}
          </h1>
          {(tournament.location || tournament.startDate) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-brand-100">
              {tournament.location && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <MapPin size={14} />
                  {tournament.location}
                </span>
              )}
              {tournament.startDate && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Calendar size={14} />
                  {new Date(tournament.startDate).toLocaleDateString("de-DE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="mt-1 hidden sm:inline-block h-7 w-0.5 rounded-full bg-gradient-to-b from-brand-500 via-brand-400 to-brand-200" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700">
                Übersicht
              </div>
              <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
                Spielklassen
              </h2>
            </div>
          </div>
          {cats.length > 0 && (
            <span className="text-xs text-ink-500 tabular-nums">
              {cats.length} {cats.length === 1 ? "Klasse" : "Klassen"}
            </span>
          )}
        </div>

        {cats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-surface p-10 text-center">
            <p className="text-sm text-ink-600">
              Für dieses Turnier stehen noch keine Spielklassen bereit.
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Schau später wieder vorbei.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {cats.map((c) => {
              const counts = countsByCat.get(c.id) ?? {
                totalPlayable: 0,
                pendingPlayable: 0,
              };
              const status = categoryStatus(c, counts);
              const statusBadge =
                status === "finished"
                  ? { label: "Beendet", cls: "badge-slate" }
                  : c.bracketDone
                    ? { label: "Finalrunde", cls: "badge-red" }
                    : c.drawDone
                      ? { label: "Gruppenphase", cls: "badge-green" }
                      : { label: "Ausstehend", cls: "badge-slate" };
              return (
                <li key={c.id}>
                  <Link
                    href={`/t/${tournament.slug}/${c.slug}`}
                    className="card-hover group block p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold tracking-tight text-ink-900 group-hover:text-brand-700 transition-colors">
                        {c.name}
                      </div>
                      <span className={statusBadge.cls}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-end text-xs text-ink-400">
                      <span className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all inline-flex items-center gap-1">
                        Ansehen <ArrowRight size={12} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
