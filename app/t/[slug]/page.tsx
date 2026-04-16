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
    <div className="min-h-screen">
      <header className="bg-brand-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold">{tournament.name}</h1>
          {tournament.location && (
            <p className="mt-1 text-brand-100">{tournament.location}</p>
          )}
          {tournament.startDate && (
            <p className="text-sm text-brand-100">
              {new Date(tournament.startDate).toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              • {tournament.startTime} Uhr
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        <h2 className="text-lg font-semibold">Spielklassen</h2>
        {cats.length === 0 ? (
          <p className="text-slate-500">
            Für dieses Turnier sind noch keine Spielklassen veröffentlicht.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {cats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/t/${tournament.slug}/${c.slug}`}
                  className="card p-4 block hover:border-brand-500"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {c.drawDone ? "Läuft" : "Vorbereitung"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
