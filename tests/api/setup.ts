import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "@/lib/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Spin up a fresh in-process Postgres (PGlite) with the full SVUTT schema
 * applied. Each call returns an isolated database — no shared state.
 *
 * This lets us exercise the Hono API without a real Postgres on the host.
 */
export async function makeTestDb(): Promise<{
  pg: PGlite;
  db: TestDb;
  drop: () => Promise<void>;
}> {
  const pg = await PGlite.create({
    extensions: { pgcrypto },
  });

  await pg.exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  const drizzleDir = join(process.cwd(), "drizzle");
  const journalRaw = readFileSync(
    join(drizzleDir, "meta", "_journal.json"),
    "utf-8",
  );
  const journal = JSON.parse(journalRaw) as {
    entries: { tag: string }[];
  };

  for (const entry of journal.entries) {
    const sql = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf-8");
    const stmts = sql
      .split(/-->\s*statement-breakpoint/i)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of stmts) {
      await pg.exec(stmt);
    }
  }

  const db = drizzle(pg, { schema });

  return {
    pg,
    db,
    drop: async () => {
      await pg.close();
    },
  };
}

type RequestableApp = {
  request: (
    input: string,
    init?: RequestInit,
  ) => Response | Promise<Response>;
};

/**
 * Helper: post JSON to a Hono app instance and return parsed response.
 */
export async function call(
  app: RequestableApp,
  path: string,
  init: RequestInit & { json?: unknown } = {},
  cookie?: string,
): Promise<{ status: number; body: unknown; setCookie: string | null }> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const body =
    init.json !== undefined ? JSON.stringify(init.json) : init.body;
  const res = await app.request(path, {
    ...init,
    headers,
    body: body as BodyInit | undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    /* leave as text */
  }
  return { status: res.status, body: parsed, setCookie };
}
