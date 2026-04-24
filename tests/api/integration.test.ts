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

  test("POST /:id/bracket refuses to rebuild once a KO match has been played", async () => {
    const tRes = await call(
      app,
      "/api/tournaments",
      { method: "POST", json: { name: "Rebuild", slug: "rebuild-t" } },
      cookie,
    );
    const tId = (tRes.body as { tournament: { id: string } }).tournament.id;
    const cRes = await call(
      app,
      `/api/tournaments/${tId}/categories`,
      {
        method: "POST",
        json: {
          name: "Cat",
          slug: "rebuild-c",
          groupSize: 4,
          groupAdvancementCount: 1,
          luckyLoserEnabled: false,
        },
      },
      cookie,
    );
    const cat = (cRes.body as { category: { id: string } }).category;
    await call(
      app,
      `/api/categories/${cat.id}/participants`,
      {
        method: "POST",
        json: { names: "A1\nA2\nA3\nA4\nB1\nB2\nB3\nB4" },
      },
      cookie,
    );
    await call(
      app,
      `/api/categories/${cat.id}/draw`,
      { method: "POST", json: { seed: "rebuild" } },
      cookie,
    );
    const state = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    const groupMatches = (
      state.body as { matches: { id: string; stage: string }[] }
    ).matches.filter((m) => m.stage === "group");
    for (const m of groupMatches) {
      await call(
        app,
        `/api/matches/${m.id}/result`,
        {
          method: "PUT",
          json: { sets: [{ a: 11, b: 5 }, { a: 11, b: 7 }] },
        },
        cookie,
      );
    }
    const br1 = await call(
      app,
      `/api/categories/${cat.id}/bracket`,
      { method: "POST" },
      cookie,
    );
    expect(br1.status).toBe(200);

    // Finish the one KO match (finale, since advancementCount=1 → size 2).
    const state2 = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    const koMatch = (
      state2.body as { matches: { id: string; stage: string }[] }
    ).matches.find((m) => m.stage === "ko")!;
    const koRes = await call(
      app,
      `/api/matches/${koMatch.id}/result`,
      {
        method: "PUT",
        json: { sets: [{ a: 11, b: 5 }, { a: 11, b: 7 }] },
      },
      cookie,
    );
    expect(koRes.status).toBe(200);

    // Rebuild now would clobber recorded results.
    const br2 = await call(
      app,
      `/api/categories/${cat.id}/bracket`,
      { method: "POST" },
      cookie,
    );
    expect(br2.status).toBe(409);
  });

  test("finishing a ko_losers match propagates the winner into the next ko_losers round", async () => {
    const tRes = await call(
      app,
      "/api/tournaments",
      { method: "POST", json: { name: "LLProp", slug: "llprop-t" } },
      cookie,
    );
    const tId = (tRes.body as { tournament: { id: string } }).tournament.id;
    const cRes = await call(
      app,
      `/api/tournaments/${tId}/categories`,
      {
        method: "POST",
        json: {
          name: "Cat",
          slug: "llprop-c",
          groupSize: 4,
          groupAdvancementCount: 1,
          luckyLoserEnabled: true,
        },
      },
      cookie,
    );
    const cat = (cRes.body as { category: { id: string } }).category;
    await call(
      app,
      `/api/categories/${cat.id}/participants`,
      {
        method: "POST",
        json: { names: "A1\nA2\nA3\nA4\nB1\nB2\nB3\nB4" },
      },
      cookie,
    );
    await call(
      app,
      `/api/categories/${cat.id}/draw`,
      { method: "POST", json: { seed: "llprop" } },
      cookie,
    );
    const state = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    const groupMatches = (
      state.body as { matches: { id: string; stage: string }[] }
    ).matches.filter((m) => m.stage === "group");
    for (const m of groupMatches) {
      await call(
        app,
        `/api/matches/${m.id}/result`,
        {
          method: "PUT",
          json: { sets: [{ a: 11, b: 5 }, { a: 11, b: 7 }] },
        },
        cookie,
      );
    }
    await call(
      app,
      `/api/categories/${cat.id}/bracket`,
      { method: "POST" },
      cookie,
    );

    const state2 = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    const allMatches = (
      state2.body as {
        matches: {
          id: string;
          stage: string;
          round: number;
          sourceMatchAId: string | null;
          sourceMatchBId: string | null;
          participantAId: string | null;
          participantBId: string | null;
        }[];
      }
    ).matches;
    const losersR0 = allMatches
      .filter((m) => m.stage === "ko_losers" && m.round === 0)
      .filter((m) => m.participantAId && m.participantBId);
    expect(losersR0.length).toBeGreaterThan(0);
    const source = losersR0[0]!;
    const downstream = allMatches.find(
      (m) =>
        m.stage === "ko_losers" &&
        (m.sourceMatchAId === source.id || m.sourceMatchBId === source.id),
    );
    expect(downstream).toBeDefined();

    await call(
      app,
      `/api/matches/${source.id}/result`,
      {
        method: "PUT",
        json: { sets: [{ a: 11, b: 5 }, { a: 11, b: 7 }] },
      },
      cookie,
    );

    const state3 = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    const downstreamAfter = (
      state3.body as {
        matches: {
          id: string;
          participantAId: string | null;
          participantBId: string | null;
        }[];
      }
    ).matches.find((m) => m.id === downstream!.id)!;
    // The propagation should have filled in the slot fed by `source`.
    const filled =
      (downstream!.sourceMatchAId === source.id &&
        downstreamAfter.participantAId === source.participantAId) ||
      (downstream!.sourceMatchBId === source.id &&
        downstreamAfter.participantAId === source.participantAId) ||
      (downstream!.sourceMatchAId === source.id &&
        downstreamAfter.participantBId === source.participantAId) ||
      (downstream!.sourceMatchBId === source.id &&
        downstreamAfter.participantBId === source.participantAId);
    expect(filled).toBe(true);
  });

  test("groups/move refuses to drop the source group below 2 members", async () => {
    const tRes = await call(
      app,
      "/api/tournaments",
      { method: "POST", json: { name: "Move", slug: "move-t" } },
      cookie,
    );
    const tId = (tRes.body as { tournament: { id: string } }).tournament.id;
    const cRes = await call(
      app,
      `/api/tournaments/${tId}/categories`,
      {
        method: "POST",
        json: { name: "Cat", slug: "move-c", groupSize: 3 },
      },
      cookie,
    );
    const cat = (cRes.body as { category: { id: string } }).category;
    await call(
      app,
      `/api/categories/${cat.id}/participants`,
      { method: "POST", json: { names: "P1\nP2\nP3\nP4\nP5\nP6" } },
      cookie,
    );
    await call(
      app,
      `/api/categories/${cat.id}/draw`,
      { method: "POST", json: { seed: "move" } },
      cookie,
    );

    const state = await call(app, `/api/categories/${cat.id}`, {}, cookie);
    const { groups: grps, members } = state.body as {
      groups: { id: string }[];
      members: { groupId: string; participantId: string }[];
    };
    expect(grps.length).toBe(2);
    const [g1, g2] = grps as [{ id: string }, { id: string }];
    const g1Members = members.filter((m) => m.groupId === g1.id);
    // First move: g1 (size 3) → g2. Source drops to 2 — allowed.
    const first = await call(
      app,
      `/api/categories/${cat.id}/groups/move`,
      {
        method: "POST",
        json: {
          participantId: g1Members[0]!.participantId,
          targetGroupId: g2.id,
        },
      },
      cookie,
    );
    expect(first.status).toBe(200);
    // Second move from g1 (now size 2) → g2. Source would drop to 1 — reject.
    const second = await call(
      app,
      `/api/categories/${cat.id}/groups/move`,
      {
        method: "POST",
        json: {
          participantId: g1Members[1]!.participantId,
          targetGroupId: g2.id,
        },
      },
      cookie,
    );
    expect(second.status).toBe(409);
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
