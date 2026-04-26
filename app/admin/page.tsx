import Link from "next/link";
import { db } from "@/lib/db/client";
import { categories, matches, tournaments } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import { CreateTournamentForm } from "@/components/admin/CreateTournamentForm";
import { ArrowRight, Plus, AlertTriangle } from "@/components/Icon";
import {
  categoryStatus,
  deriveTournamentStatus,
  type DerivedStatus,
} from "@/lib/tournamentStatus";

export const dynamic = "force-dynamic";

function statusLabel(status: DerivedStatus): { label: string; cls: string } {
  switch (status) {
    case "running":
      return { label: "Läuft gerade", cls: "badge-green" };
    case "finished":
      return { label: "Beendet", cls: "badge-slate" };
    default:
      return { label: "In Vorbereitung", cls: "badge-amber" };
  }
}

export default async function AdminHomePage() {
  let list: (typeof tournaments.$inferSelect)[] = [];
  let dbError: string | null = null;
  let statusByTournament = new Map<string, DerivedStatus>();
  try {
    list = await db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.createdAt));

    if (list.length > 0) {
      const ids = list.map((t) => t.id);
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

      const perTournament = new Map<string, DerivedStatus[]>();
      for (const c of cats) {
        const counts = countsByCat.get(c.id) ?? {
          totalPlayable: 0,
          pendingPlayable: 0,
        };
        const arr = perTournament.get(c.tournamentId) ?? [];
        arr.push(categoryStatus(c, counts));
        perTournament.set(c.tournamentId, arr);
      }
      for (const [tid, statuses] of perTournament) {
        statusByTournament.set(tid, deriveTournamentStatus(statuses));
      }
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Datenbank nicht erreichbar.";
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deine Turniere</h1>
          <p className="mt-1 text-ink-500">
            Alles an einem Ort. Lege ein neues Turnier an oder öffne ein
            bestehendes.
          </p>
        </div>
        <CreateTournamentForm />
      </div>

      {dbError && (
        <div className="card border-brand-200 bg-brand-50/50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-brand-600"><AlertTriangle size={20} /></span>
            <div className="text-sm text-brand-800">
              <div className="font-semibold">Keine Datenbank erreichbar</div>
              <p className="mt-1">{dbError}</p>
              <p className="mt-2 text-brand-700">
                Prüfe <code className="kbd">DATABASE_URL</code> und führe{" "}
                <code className="kbd">pnpm db:migrate</code> aus.
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-surface p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Plus size={20} />
            </div>
            <h3 className="mt-4 font-semibold">Noch kein Turnier angelegt</h3>
            <p className="mt-1 text-sm text-ink-500">
              Starte mit deinem ersten Turnier. Das dauert eine Minute.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => {
              const derived = statusByTournament.get(t.id) ?? "draft";
              const s = statusLabel(derived);
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/t/${t.id}`}
                    className="card-hover group flex h-full flex-col p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold tracking-tight text-ink-900 group-hover:text-brand-700 transition-colors truncate">
                          {t.name}
                        </div>
                        {t.location && (
                          <div className="mt-1 text-sm text-ink-500 truncate">
                            {t.location}
                          </div>
                        )}
                      </div>
                      <span className={s.cls}>{s.label}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-ink-400 font-mono">
                      <span>/{t.slug}</span>
                      <span className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all">
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
