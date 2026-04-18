import Link from "next/link";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ClubMark } from "@/components/ClubMark";
import { ArrowRight, ExternalLink } from "@/components/Icon";

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
    <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
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

      <div className="mt-12">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900">
            Turniere
          </h1>
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
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Zum Admin-Bereich <ArrowRight size={14} />
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
                      <ArrowRight size={18} />
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
      </div>
    </main>
  );
}
