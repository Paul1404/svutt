import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, tournaments } from "@/lib/db/schema";
import { CreateCategoryForm } from "@/components/admin/CreateCategoryForm";
import { TournamentSettings } from "@/components/admin/TournamentSettings";
import { QrShare } from "@/components/admin/QrShare";
import { ArrowLeft, ArrowRight } from "@/components/Icon";

export const dynamic = "force-dynamic";

function statusLabel(status: string): { label: string; cls: string } {
  switch (status) {
    case "running":
      return { label: "Läuft", cls: "badge-green" };
    case "finished":
      return { label: "Abgeschlossen", cls: "badge-slate" };
    default:
      return { label: "In Vorbereitung", cls: "badge-amber" };
  }
}

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

  const s = statusLabel(tournament.status);

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft size={14} /> Alle Turniere
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">
                {tournament.name}
              </h1>
              <span className={s.cls}>{s.label}</span>
            </div>
            <p className="mt-1 text-sm text-ink-500 font-mono">
              /{tournament.slug}
              {tournament.location && (
                <span className="font-sans"> · {tournament.location}</span>
              )}
            </p>
          </div>
          <QrShare slug={tournament.slug} />
        </div>
      </div>

      <TournamentSettings tournament={tournament} />

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Spielklassen
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Eine Spielklasse ist zum Beispiel „Herren" oder „Jugend U18".
            </p>
          </div>
        </div>

        {cats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-white p-10 text-center">
            <p className="text-sm text-ink-600">
              Noch keine Spielklasse angelegt.
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Lege unten die erste an, um Teilnehmer einzutragen.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {cats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/t/${tournament.id}/c/${c.id}`}
                  className="card-hover group block p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold tracking-tight group-hover:text-brand-700 transition-colors">
                        {c.name}
                      </div>
                      <div className="mt-1 text-xs text-ink-500">
                        Gruppen à {c.groupSize}
                        <span className="text-ink-300 mx-1.5">·</span>
                        Best of {c.winSets * 2 - 1}
                      </div>
                    </div>
                    <span className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all">
                      <ArrowRight size={14} />
                    </span>
                  </div>
                  <div className="mt-3 flex gap-1.5 flex-wrap">
                    {c.drawDone ? (
                      <span className="badge-green">Gruppen gezogen</span>
                    ) : (
                      <span className="badge-slate">Noch nicht gezogen</span>
                    )}
                    {c.bracketDone && (
                      <span className="badge-red">Finalrunde läuft</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <CreateCategoryForm tournamentId={tournament.id} />
        </div>
      </section>
    </div>
  );
}
