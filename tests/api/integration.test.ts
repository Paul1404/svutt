import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { makeTestDb, call, type TestDb } from "./setup";

// Test environment must be set before the auth/session module is imported.
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "test-password-123";
process.env.SESSION_SECRET = "test-secret-at-least-16-characters-long";

// Hoisted holder so vi.mock can return a getter that resolves at runtime.
const dbHolder = vi.hoisted(() => ({ db: null as TestDb | null }));

vi.mock("@/lib/db/client", () => ({
  get db() {
    if (!dbHolder.db) throw new Error("Test DB not initialised yet");
    return dbHolder.db;
  },
  schema,
}));

let app: typeof import("@/lib/api/app").api;
let drop: () => Promise<void>;
let cookie: string;

beforeAll(async () => {
  const t = await makeTestDb();
  dbHolder.db = t.db;
  drop = t.drop;
  // Import after the mock is set up so the routes pick up the mocked db.
  ({ api: app } = await import("@/lib/api/app"));

  const login = await call(app, "/api/auth/login", {
    method: "POST",
    json: { username: "admin", password: "test-password-123" },
  });
  expect(login.status).toBe(200);
  expect(login.setCookie).toMatch(/^svutt_session=/);
  cookie = login.setCookie!.split(";")[0]!;
});

afterAll(async () => {
  await drop?.();
});

describe("API integration: full tournament happy path", () => {
  test("health endpoint is unauthenticated", async () => {
    const res = await call(app, "/api/health");
    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);
  });

  test("admin endpoints reject without cookie", async () => {
    const res = await call(app, "/api/tournaments");
    expect(res.status).toBe(401);
  });

  test("create + list + get + delete a tournament", async () => {
    const create = await call(
      app,
      "/api/tournaments",
      {
        method: "POST",
        json: {
          name: "Test Cup",
          slug: "test-cup",
          location: "Halle",
          parallelTables: 2,
          matchDurationMinutes: 11,
        },
      },
      cookie,
    );
    expect(create.status).toBe(201);
    const tournament = (create.body as { tournament: { id: string } })
      .tournament;
    expect(tournament.id).toBeTruthy();

    const list = await call(app, "/api/tournaments", {}, cookie);
    expect((list.body as { tournaments: unknown[] }).tournaments.length).toBe(1);

    const get = await call(app, `/api/tournaments/${tournament.id}`, {}, cookie);
    expect(get.status).toBe(200);

    const del = await call(
      app,
      `/api/tournaments/${tournament.id}`,
      { method: "DELETE" },
      cookie,
    );
    expect(del.status).toBe(200);

    const getAgain = await call(
      app,
      `/api/tournaments/${tournament.id}`,
      {},
      cookie,
    );
    expect(getAgain.status).toBe(404);
  });

  test("end-to-end: create tournament → category → participants → draw → enter results → bracket", async () => {
    // 1. Tournament
    const tRes = await call(
      app,
      "/api/tournaments",
      {
        method: "POST",
        json: {
          name: "Vereinsmeisterschaft",
          slug: "vereinsmeisterschaft",
          parallelTables: 2,
          matchDurationMinutes: 11,
        },
      },
      cookie,
    );
    expect(tRes.status).toBe(201);
    const tId = (tRes.body as { tournament: { id: string } }).tournament.id;

    // 2. Category with non-default rules to confirm threading
    const cRes = await call(
      app,
      `/api/tournaments/${tId}/categories`,
      {
        method: "POST",
        json: {
          name: "Herren",
          slug: "herren",
          groupSize: 4,
          winSets: 2,
          setPoints: 11,
          setMinLead: 2,
          groupAdvancementCount: 1,
          luckyLoserEnabled: true,
        },
      },
      cookie,
    );
    expect(cRes.status).toBe(201);
    const cat = (cRes.body as { category: typeof schema.categories.$inferSelect })
      .category;
    expect(cat.setPoints).toBe(11);
    expect(cat.luckyLoserEnabled).toBe(true);

    // 3. Bulk participants — 8 names → 2 groups of 4
    const pRes = await call(
      app,
      `/api/categories/${cat.id}/participants`,
      {
        method: "POST",
        json: {
          names: "Anna\nBernd\nClara\nDavid\nEmma\nFelix\nGreta\nHugo",
        },
      },
      cookie,
    );
    expect(pRes.status).toBe(201);
    const participants = (
      pRes.body as { participants: { id: string; name: string }[] }
    ).participants;
    expect(participants.length).toBe(8);

    // 4. Draw (deterministic via seed)
    const drawRes = await call(
      app,
      `/api/categories/${cat.id}/draw`,
      { method: "POST", json: { seed: "vitest-seed" } },
      cookie,
    );
    expect(drawRes.status).toBe(200);

    // 5. Get full state
    const stateRes = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    expect(stateRes.status).toBe(200);
    const state = stateRes.body as {
      groups: { id: string }[];
      matches: {
        id: string;
        stage: string;
        participantAId: string | null;
        participantBId: string | null;
      }[];
    };
    expect(state.groups.length).toBe(2);
    const groupMatches = state.matches.filter((m) => m.stage === "group");
    expect(groupMatches.length).toBe(12); // 2 groups of 4 → 6 matches each

    // 6. Submit results for every group match (A wins all 2:0, 11:5/11:7)
    for (const m of groupMatches) {
      const resultRes = await call(
        app,
        `/api/matches/${m.id}/result`,
        {
          method: "PUT",
          json: {
            sets: [
              { a: 11, b: 5 },
              { a: 11, b: 7 },
            ],
          },
        },
        cookie,
      );
      expect(resultRes.status).toBe(200);
    }

    // 7. Build bracket
    const brRes = await call(
      app,
      `/api/categories/${cat.id}/bracket`,
      { method: "POST" },
      cookie,
    );
    expect(brRes.status).toBe(200);
    const bracketBody = brRes.body as {
      ok: true;
      size: number;
      losersSize: number;
    };
    // advancementCount=1: 2 group winners → Finale of size 2.
    expect(bracketBody.size).toBe(2);
    // Losers bracket: ranks 2..4 from each of the 2 groups = 6 → size 8.
    expect(bracketBody.losersSize).toBe(8);

    // 8. Public endpoint reflects everything (no auth required)
    const pub = await call(app, "/api/public/t/vereinsmeisterschaft");
    expect(pub.status).toBe(200);
    const pubCat = await call(
      app,
      "/api/public/t/vereinsmeisterschaft/c/herren",
    );
    expect(pubCat.status).toBe(200);
  });

  test("custom set rules (15 points, lead 3) accept matching scores", async () => {
    const tRes = await call(
      app,
      "/api/tournaments",
      {
        method: "POST",
        json: { name: "Schul-Cup", slug: "schul-cup" },
      },
      cookie,
    );
    const tId = (tRes.body as { tournament: { id: string } }).tournament.id;
    const cRes = await call(
      app,
      `/api/tournaments/${tId}/categories`,
      {
        method: "POST",
        json: {
          name: "Schule",
          slug: "schule",
          groupSize: 4,
          winSets: 2,
          setPoints: 15,
          setMinLead: 3,
          luckyLoserEnabled: false,
        },
      },
      cookie,
    );
    const cat = (cRes.body as { category: typeof schema.categories.$inferSelect })
      .category;
    expect(cat.setPoints).toBe(15);
    expect(cat.luckyLoserEnabled).toBe(false);

    await call(
      app,
      `/api/categories/${cat.id}/participants`,
      {
        method: "POST",
        json: { names: "P1\nP2\nP3\nP4" },
      },
      cookie,
    );
    await call(
      app,
      `/api/categories/${cat.id}/draw`,
      { method: "POST", json: { seed: "x" } },
      cookie,
    );
    const state = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    const m = (state.body as {
      matches: { id: string; stage: string }[];
    }).matches.find((x) => x.stage === "group")!;

    // 11:5 would be invalid (need 15) but 15:5 is valid.
    const bad = await call(
      app,
      `/api/matches/${m.id}/result`,
      {
        method: "PUT",
        json: {
          sets: [
            { a: 11, b: 5 },
            { a: 11, b: 7 },
          ],
        },
      },
      cookie,
    );
    expect(bad.status).toBe(400);

    const good = await call(
      app,
      `/api/matches/${m.id}/result`,
      {
        method: "PUT",
        json: {
          sets: [
            { a: 15, b: 5 },
            { a: 15, b: 12 },
          ],
        },
      },
      cookie,
    );
    expect(good.status).toBe(200);
  });

  test("category PATCH updates new fields", async () => {
    const tRes = await call(
      app,
      "/api/tournaments",
      { method: "POST", json: { name: "Patch", slug: "patch-t" } },
      cookie,
    );
    expect(tRes.status).toBe(201);
    const tId = (tRes.body as { tournament: { id: string } }).tournament.id;
    const cRes = await call(
      app,
      `/api/tournaments/${tId}/categories`,
      { method: "POST", json: { name: "Cat", slug: "patch-c" } },
      cookie,
    );
    expect(cRes.status).toBe(201);
    const cat = (cRes.body as { category: { id: string } }).category;

    const patchRes = await call(
      app,
      `/api/categories/${cat.id}`,
      {
        method: "PATCH",
        json: { setPoints: 21, setMinLead: 2, luckyLoserEnabled: false },
      },
      cookie,
    );
    expect(patchRes.status).toBe(200);
    const updated = (patchRes.body as {
      category: typeof schema.categories.$inferSelect;
    }).category;
    expect(updated.setPoints).toBe(21);
    expect(updated.setMinLead).toBe(2);
    expect(updated.luckyLoserEnabled).toBe(false);
  });
});
