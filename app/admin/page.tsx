import Link from "next/link";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { CreateTournamentForm } from "@/components/admin/CreateTournamentForm";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  let list: (typeof tournaments.$inferSelect)[] = [];
  let dbError: string | null = null;
  try {
    list = await db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.createdAt));
  } catch (e) {
    dbError =
      e instanceof Error ? e.message : "Datenbank nicht erreichbar.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Turniere</h1>
        <p className="text-slate-500 text-sm">
          Erstelle ein neues Turnier oder bearbeite ein bestehendes.
        </p>
      </div>

      {dbError && (
        <div className="card p-4 border-red-300 bg-red-50 text-red-800 text-sm">
          Datenbankfehler: {dbError}
          <div className="mt-1">
            Stelle sicher, dass <code>DATABASE_URL</code> gesetzt ist und die
            Migration ausgeführt wurde: <code>pnpm db:migrate</code>.
          </div>
        </div>
      )}

      <CreateTournamentForm />

      <div>
        <h2 className="text-lg font-semibold mb-3">Alle Turniere</h2>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Turniere vorhanden.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/t/${t.id}`}
                  className="card p-4 block hover:border-brand-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        /{t.slug} • {t.status}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        t.status === "running"
                          ? "bg-green-100 text-green-800"
                          : t.status === "finished"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
