import Link from "next/link";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let list: { id: string; name: string; slug: string; location: string | null }[] = [];
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
    // DB not configured yet; keep list empty.
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        SVUTT — Tischtennis Turniersoftware
      </h1>
      <p className="mt-4 text-slate-600">
        Verwalte Tischtennis-Turniere mit Gruppenphase, automatischer Auslosung,
        K.O.-Baum inkl. Lucky Loser und Spielzeit-Kalkulation. Ergebnisse landen
        live auf der Public View — ideal zum Anzeigen an der Turnierhalle.
      </p>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Aktuelle Turniere</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Noch keine Turniere veröffentlicht.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/t/${t.slug}`}
                  className="block rounded-md border border-slate-200 bg-white p-4 hover:border-brand-500"
                >
                  <div className="font-medium">{t.name}</div>
                  {t.location && (
                    <div className="text-sm text-slate-500">{t.location}</div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-12 text-sm text-slate-500">
        <Link href="/admin" className="underline">
          Admin-Bereich →
        </Link>
      </div>
    </main>
  );
}
