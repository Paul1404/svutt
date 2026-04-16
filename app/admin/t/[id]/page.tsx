import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, tournaments } from "@/lib/db/schema";
import { CreateCategoryForm } from "@/components/admin/CreateCategoryForm";
import { TournamentSettings } from "@/components/admin/TournamentSettings";
import { QrShare } from "@/components/admin/QrShare";

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  if (!tournament) notFound();

  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.tournamentId, id))
    .orderBy(asc(categories.sortOrder));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:underline">
            ← Turniere
          </Link>
          <h1 className="text-2xl font-bold mt-1">{tournament.name}</h1>
          <p className="text-sm text-slate-500">
            /{tournament.slug} • Status: {tournament.status}
          </p>
        </div>
        <QrShare slug={tournament.slug} />
      </div>

      <TournamentSettings tournament={tournament} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Spielklassen</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`/admin/t/${tournament.id}/c/${c.id}`}
              className="card p-4 block hover:border-brand-500"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-slate-500 mt-1">
                /{c.slug} • Gruppen à {c.groupSize} • Best of {c.winSets * 2 - 1}
              </div>
              <div className="mt-2 flex gap-1">
                {c.drawDone && (
                  <span className="badge bg-green-100 text-green-800">
                    Gruppen gezogen
                  </span>
                )}
                {c.bracketDone && (
                  <span className="badge bg-blue-100 text-blue-800">
                    KO aktiv
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4">
          <CreateCategoryForm tournamentId={tournament.id} />
        </div>
      </section>
    </div>
  );
}
