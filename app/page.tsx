import Link from "next/link";
import { db } from "@/lib/db/client";
import { categories, matches, tournaments } from "@/lib/db/schema";
import { desc, inArray, eq } from "drizzle-orm";
import { ClubMark } from "@/components/ClubMark";
import { ArrowRight, ExternalLink } from "@/components/Icon";
import {
  categoryStatus,
  deriveTournamentStatus,
  type DerivedStatus,
} from "@/lib/tournamentStatus";

export const dynamic = "force-dynamic";

type Card = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  status: DerivedStatus;
};

function statusBadge(status: DerivedStatus): { label: string; cls: string } {
  switch (status) {
    case "running":
      return { label: "Läuft", cls: "badge-green" };
    case "finished":
      return { label: "Beendet", cls: "badge-slate" };
    default:
      return { label: "In Vorbereitung", cls: "badge-amber" };
  }
}

export default async function HomePage() {
  let list: Card[] = [];
  try {
    const tRows = await db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        slug: tournaments.slug,
        location: tournaments.location,
      })
      .from(tournaments)
      .orderBy(desc(tournaments.createdAt))
      .limit(20);

    if (tRows.length > 0) {
      const ids = tRows.map((t) => t.id);
      const cats = await db
        .select({
          tournamentId: categories.tournamentId,
          id: categories.id,
          drawDone: categories.drawDone,
          bracketDone: categories.bracketDone,
          structure: categories.structure,
        })
        .from(categories)
        .where(inArray(categories.tournamentId, ids));

      const catIds = cats.map((c) => c.id);
      const matchRows = catIds.length
        ? await db
            .select({
              categoryId: matches.categoryId,
              status: matches.status,
              participantAId: matches.participantAId,
              participantBId: matches.participantBId,
            })
            .from(matches)
            .where(inArray(matches.categoryId, catIds))
        : [];

      const countsByCat = new Map<
        string,
        { totalPlayable: number; pendingPlayable: number }
      >();
      for (const m of matchRows) {
        if (m.participantAId === null || m.participantBId === null) continue;
        const c = countsByCat.get(m.categoryId) ?? {
          totalPlayable: 0,
          pendingPlayable: 0,
        };
        c.totalPlayable++;
        if (m.status !== "finished") c.pendingPlayable++;
        countsByCat.set(m.categoryId, c);
      }

      const statusesByTournament = new Map<string, DerivedStatus[]>();
      for (const c of cats) {
        const counts = countsByCat.get(c.id) ?? {
          totalPlayable: 0,
          pendingPlayable: 0,
        };
        const arr = statusesByTournament.get(c.tournamentId) ?? [];
        arr.push(categoryStatus(c, counts));
        statusesByTournament.set(c.tournamentId, arr);
      }

      list = tRows.map((t) => ({
        ...t,
        status: deriveTournamentStatus(
          statusesByTournament.get(t.id) ?? [],
        ),
      }));
    }
  } catch {
    // Datenbank noch nicht bereit. Liste bleibt leer.
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto max-w-4xl px-4 pt-12 pb-16 sm:pt-16 sm:pb-24"
    >
      <div className="flex items-center justify-between gap-4">
        <ClubMark size="md" labelClassName="text-ink-700" />
        <a
          href="https://sv-untereuerheim.de"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-ink-500 hover:text-brand-600 transition-colors inline-flex items-center gap-1"
        >
          sv-untereuerheim.de <ExternalLink size={12} />
        </a>
      </div>

      <section className="mt-16 sm:mt-24">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-ink-900">
              Turniere
            </h1>
            <p className="mt-3 max-w-xl text-ink-500">
              Live-Spielpläne, Tabellen und Ergebnisse aus dem Vereinsheim.
              Tippe ein Turnier an, um die aktuellen Spiele zu sehen.
            </p>
          </div>
          {list.length > 0 && (
            <span className="text-xs font-medium text-ink-500">
              {list.length} {list.length === 1 ? "Turnier" : "Turniere"}
            </span>
          )}
        </div>

        {list.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-12 text-center">
            <p className="text-sm text-ink-600">
              Noch keine Turniere angelegt.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Zum Organisator-Bereich <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {list.map((t) => {
              const badge = statusBadge(t.status);
              return (
                <li key={t.id}>
                  <Link
                    href={`/t/${t.slug}`}
                    className="card-hover group block p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold tracking-tight text-ink-900 group-hover:text-brand-700 transition-colors">
                          {t.name}
                        </div>
                        {t.location && (
                          <div className="mt-1 text-sm text-ink-500">
                            {t.location}
                          </div>
                        )}
                      </div>
                      <span className={badge.cls}>{badge.label}</span>
                    </div>
                    <div className="mt-5 flex items-center justify-end text-sm text-ink-400">
                      <span className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all inline-flex items-center gap-1">
                        Ansehen <ArrowRight size={14} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-24 border-t border-ink-100 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-ink-500 leading-relaxed">
            <div className="font-semibold text-ink-700">
              SV 1945 Untereuerheim e.V.
            </div>
            <div>Triebweg 9 · 97508 Grettstadt-Untereuerheim</div>
          </div>
          <Link
            href="/admin"
            className="text-sm font-medium text-ink-600 hover:text-brand-600"
          >
            Organisator-Bereich
          </Link>
        </div>
      </footer>
    </main>
  );
}
