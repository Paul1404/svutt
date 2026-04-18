import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, tournaments } from "@/lib/db/schema";

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
    .where(eq(categories.tournamentId, tournament.id))
    .orderBy(asc(categories.sortOrder));

  return (
    <div className="min-h-screen bg-white">
      <header className="relative overflow-hidden bg-brand-700 text-white">
        <div
          className="absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgb(255 255 255 / 0.4), transparent 50%), radial-gradient(circle at 80% 80%, rgb(255 255 255 / 0.2), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-brand-100 hover:text-white transition-colors"
          >
            <span aria-hidden>←</span> Alle Turniere
          </Link>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight">
            {tournament.name}
          </h1>
          {(tournament.location || tournament.startDate) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-brand-100">
              {tournament.location && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span aria-hidden>📍</span>
                  {tournament.location}
                </span>
              )}
              {tournament.startDate && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span aria-hidden>📅</span>
                  {new Date(tournament.startDate).toLocaleDateString("de-DE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {", "}
                  {tournament.startTime} Uhr
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Spielklassen</h2>
          {cats.length > 0 && (
            <span className="text-xs text-ink-500">
              {cats.length} {cats.length === 1 ? "Klasse" : "Klassen"}
            </span>
          )}
        </div>

        {cats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-white p-10 text-center">
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
              const statusBadge = c.bracketDone
                ? { label: "Finalrunde", cls: "badge-red" }
                : c.drawDone
                  ? { label: "Gruppenphase", cls: "badge-green" }
                  : { label: "Startet bald", cls: "badge-amber" };
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
                      <span className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all">
                        Ansehen →
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
