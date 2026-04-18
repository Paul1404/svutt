import Link from "next/link";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

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
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm shadow-soft">
          S
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink-700">
          SVUTT
        </span>
      </div>

      <h1 className="mt-10 text-5xl sm:text-6xl font-bold tracking-tight text-ink-900">
        Tischtennis-Turniere,
        <br />
        <span className="text-brand-600">ohne den Papierkram.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-600 leading-relaxed">
        Gruppen ziehen, Ergebnisse eintippen, Finalbaum live zeigen. Alles an
        einem Ort, auch vom Handy am Spieltisch.
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

      <div className="mt-20 flex items-center justify-between border-t border-ink-100 pt-6">
        <p className="text-xs text-ink-400">
          Open Source auf GitHub
        </p>
        <Link
          href="/admin"
          className="text-sm font-medium text-ink-600 hover:text-brand-600"
        >
          Admin-Bereich
        </Link>
      </div>
    </main>
  );
}
