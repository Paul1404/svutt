import { Hono } from "hono";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  categories,
  groupMembers,
  groups,
  matches,
  matchSets,
  participants,
  tournaments,
} from "@/lib/db/schema";
import { computeStandings, type EngineGroup, type Player } from "@/lib/engine";
import {
  currentCategoryRevision,
  subscribeCategory,
} from "@/lib/live";
import { notFound } from "../helpers";

export const publicRoutes = new Hono()
  .get("/t/:slug", async (c) => {
    const slug = c.req.param("slug");
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, slug))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

    const cats = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.tournamentId, tournament.id),
          eq(categories.published, true),
        ),
      )
      .orderBy(asc(categories.sortOrder));

    return c.json({ tournament, categories: cats });
  })
  .get("/t/:slug/c/:catSlug", async (c) => {
    const slug = c.req.param("slug");
    const catSlug = c.req.param("catSlug");

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, slug))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

    const [category] = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.tournamentId, tournament.id),
          eq(categories.slug, catSlug),
        ),
      )
      .limit(1);
    if (!category || !category.published) return notFound(c, "Spielklasse");

    const catGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.categoryId, category.id))
      .orderBy(asc(groups.position));

    const parts = await db
      .select()
      .from(participants)
      .where(eq(participants.categoryId, category.id));

    const members = catGroups.length
      ? await db
          .select()
          .from(groupMembers)
          .where(
            inArray(
              groupMembers.groupId,
              catGroups.map((g) => g.id),
            ),
          )
      : [];

    const matchRows = await db
      .select()
      .from(matches)
      .where(eq(matches.categoryId, category.id))
      .orderBy(asc(matches.playOrder));

    const setRows = matchRows.length
      ? await db
          .select()
          .from(matchSets)
          .where(
            inArray(
              matchSets.matchId,
              matchRows.map((m) => m.id),
            ),
          )
          .orderBy(asc(matchSets.setNumber))
      : [];

    // Build standings via engine
    const partsById = new Map(parts.map((p) => [p.id, p]));
    const setsByMatch = new Map<string, { a: number; b: number }[]>();
    for (const s of setRows) {
      const arr = setsByMatch.get(s.matchId) ?? [];
      arr.push({ a: s.pointsA, b: s.pointsB });
      setsByMatch.set(s.matchId, arr);
    }

    const engineGroups: EngineGroup[] = catGroups.map((g) => {
      const gMembers = members
        .filter((m) => m.groupId === g.id)
        .sort((a, b) => a.position - b.position);
      const players: Player[] = gMembers.map((m) => {
        const p = partsById.get(m.participantId);
        return {
          id: m.participantId,
          name: p?.name ?? "?",
          club: p?.club ?? undefined,
        };
      });
      const gMatches = matchRows
        .filter((m) => m.stage === "group" && m.groupId === g.id)
        .map((m) => ({
          id: m.id,
          a: m.participantAId,
          b: m.participantBId,
          sets: setsByMatch.get(m.id) ?? [],
        }));
      return { id: g.id, label: g.label, players, matches: gMatches };
    });

    const standings = engineGroups.map((g) => computeStandings(g));

    return c.json({
      tournament,
      category,
      groups: catGroups,
      members,
      participants: parts,
      matches: matchRows,
      sets: setRows,
      standings,
    });
  })
  // Server-Sent Events stream. Clients open an EventSource and receive a
  // `revision` event whenever the category's underlying data changes (match
  // results, draw, bracket build, publish toggle). The page then re-fetches
  // through its normal server component path — no DB reads happen inside
  // the stream itself, so this is cheap to keep open.
  .get("/t/:slug/c/:catSlug/live", async (c) => {
    const slug = c.req.param("slug");
    const catSlug = c.req.param("catSlug");

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, slug))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

    const [category] = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.tournamentId, tournament.id),
          eq(categories.slug, catSlug),
        ),
      )
      .limit(1);
    if (!category || !category.published) return notFound(c, "Spielklasse");

    const categoryId = category.id;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const send = (event: string, data: string) => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
            );
          } catch {
            closed = true;
          }
        };

        // Kick things off with the current revision so a freshly opened
        // connection knows whether it's already behind.
        send("hello", String(currentCategoryRevision(categoryId)));

        const unsubscribe = subscribeCategory(categoryId, (revision) => {
          send("revision", String(revision));
        });

        // Heartbeats keep proxies from killing the connection mid-tournament.
        // Every 25s is well under the typical 30s idle timeout.
        const heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            closed = true;
          }
        }, 25_000);

        const abort = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        c.req.raw.signal.addEventListener("abort", abort);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        // Nginx/Cloudflare: do not buffer.
        "x-accel-buffering": "no",
      },
    });
  });
