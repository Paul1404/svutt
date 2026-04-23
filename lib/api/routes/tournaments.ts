import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  categories,
  tournaments,
} from "@/lib/db/schema";
import {
  createTournamentSchema,
  updateTournamentSchema,
} from "@/lib/validators";
import { notFound, parseJson, conflict } from "../helpers";

export const tournamentRoutes = new Hono()
  .get("/", async (c) => {
    const rows = await db
      .select()
      .from(tournaments)
      .orderBy(tournaments.createdAt);
    return c.json({ tournaments: rows });
  })
  .post("/", async (c) => {
    const parsed = await parseJson(c, createTournamentSchema);
    if (!parsed.ok) return parsed.response;

    const { name, slug, location, startDate, parallelTables, matchDurationMinutes } =
      parsed.data;

    const existing = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.slug, slug))
      .limit(1);
    if (existing.length > 0) {
      return conflict(c, "Slug ist bereits vergeben.");
    }

    const [created] = await db
      .insert(tournaments)
      .values({
        name,
        slug,
        location: location && location.length > 0 ? location : null,
        startDate: startDate && startDate.length > 0 ? new Date(startDate) : null,
        parallelTables: parallelTables ?? 3,
        matchDurationMinutes: matchDurationMinutes ?? 11,
      })
      .returning();

    return c.json({ tournament: created }, 201);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const [row] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, id))
      .limit(1);
    if (!row) return notFound(c, "Turnier");
    const cats = await db
      .select()
      .from(categories)
      .where(eq(categories.tournamentId, id))
      .orderBy(categories.sortOrder);
    return c.json({ tournament: row, categories: cats });
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    const parsed = await parseJson(c, updateTournamentSchema);
    if (!parsed.ok) return parsed.response;

    const data = parsed.data;
    const update: Partial<typeof tournaments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) update.name = data.name;
    if (data.slug !== undefined) update.slug = data.slug;
    if (data.location !== undefined)
      update.location = data.location && data.location.length > 0 ? data.location : null;
    if (data.startDate !== undefined)
      update.startDate =
        data.startDate && data.startDate.length > 0 ? new Date(data.startDate) : null;
    if (data.parallelTables !== undefined) update.parallelTables = data.parallelTables;
    if (data.matchDurationMinutes !== undefined)
      update.matchDurationMinutes = data.matchDurationMinutes;
    if (data.status !== undefined) update.status = data.status;

    const [row] = await db
      .update(tournaments)
      .set(update)
      .where(eq(tournaments.id, id))
      .returning();
    if (!row) return notFound(c, "Turnier");
    return c.json({ tournament: row });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [row] = await db
      .delete(tournaments)
      .where(eq(tournaments.id, id))
      .returning();
    if (!row) return notFound(c, "Turnier");
    return c.json({ ok: true });
  })
  // Categories scoped to a tournament
  .get("/:id/categories", async (c) => {
    const id = c.req.param("id");
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.tournamentId, id))
      .orderBy(categories.sortOrder);
    return c.json({ categories: rows });
  })
  .post("/:id/categories", async (c) => {
    const id = c.req.param("id");
    const parsed = await parseJson(c, (await import("@/lib/validators")).createCategorySchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const exists = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tournamentId, id), eq(categories.slug, data.slug)))
      .limit(1);
    if (exists.length > 0) return conflict(c, "Slug ist bereits vergeben.");

    const [created] = await db
      .insert(categories)
      .values({
        tournamentId: id,
        name: data.name,
        slug: data.slug,
        groupSize: data.groupSize ?? 4,
        winSets: data.winSets ?? 2,
        setPoints: data.setPoints ?? 11,
        setMinLead: data.setMinLead ?? 2,
        groupAdvancementCount: data.groupAdvancementCount ?? 2,
        luckyLoserEnabled: data.luckyLoserEnabled ?? true,
        structure: data.structure ?? "groups_ko",
        drawMode: data.drawMode ?? "random",
        swissRounds: data.swissRounds ?? 5,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return c.json({ category: created }, 201);
  });
