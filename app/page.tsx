import Link from "next/link";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ClubMark } from "@/components/ClubMark";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let list: {
    id: string;
    name: string;
    slug: string;
    location: string | null;
  }[] = [];
  try {
    list = await db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        slug: tournaments.slug,
        location: tournaments.location,
      })
      .from(tournaments)
      .orderBy(desc(tournaments.createdAt))
      .limit(20);
  } catch {
    // Datenbank noch nicht bereit. Liste bleibt leer.
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
      <div className="flex items-center justify-between gap-4">
        <ClubMark size="md" labelClassName="text-ink-700" />
        <a
          href="https://sv-untereuerheim.de"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-ink-500 hover:text-brand-600 transition-colors inline-flex items-center gap-1"
        >
          sv-untereuerheim.de <span aria-hidden>↗</span>
        </a>
      </div>

      <p className="mt-12 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
        Tischtennis · Abteilung
      </p>
      <h1 className="mt-3 text-5xl sm:text-6xl font-bold tracking-tight text-ink-900">
        Turniere des
        <br />
        <span className="text-brand-600">SV 1945 Untereuerheim.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-600 leading-relaxed">
        Gruppen, Ergebnisse und der Finalbaum — live aus der Halle. Vom
        Spieltisch direkt aufs Handy, für Spieler:innen, Schiris und alle, die
        zuschauen.
      </p>

      <div className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Aktuelle Turniere
          </h2>
          {list.length > 0 && (
            <span className="text-xs text-ink-500">
              {list.length} {list.length === 1 ? "Turnier" : "Turniere"}
            </span>
          )}
        </div>

        {list.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-10 text-center">
            <p className="text-sm text-ink-600">
              Noch keine Turniere angelegt.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Zum Admin-Bereich →
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/t/${t.slug}`}
                  className="card-hover group block p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold tracking-tight text-ink-900 group-hover:text-brand-700 transition-colors">
                        {t.name}
                      </div>
                      {t.location && (
                        <div className="mt-1 text-sm text-ink-500">
                          {t.location}
                        </div>
                      )}
                    </div>
                    <span className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-20 border-t border-ink-100 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            Admin-Bereich
          </Link>
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-wider text-ink-400">
          Wir sind Untereuerheim
        </p>
      </div>
    </main>
  );
}
