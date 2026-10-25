import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { tournamentRoutes } from "./routes/tournaments";
import { categoryRoutes } from "./routes/categories";
import { matchRoutes } from "./routes/matches";
import { publicRoutes } from "./routes/public";
import { adminRoutes } from "./routes/admin";
import { requireAdmin } from "./middleware";

export const api = new Hono().basePath("/api");

api.get("/health", async (c) => {
  c.header("Cache-Control", "no-store");
  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(sql`SET LOCAL statement_timeout = '2s'`);
      await transaction.execute(sql`SELECT 1`);
    });
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

api.route("/auth", authRoutes);
api.route("/public", publicRoutes);

// Admin-only below. Cover both bare prefix and sub-paths.
for (const p of [
  "/tournaments",
  "/tournaments/*",
  "/categories",
  "/categories/*",
  "/matches",
  "/matches/*",
  "/admin",
  "/admin/*",
]) {
  api.use(p, requireAdmin);
}

api.route("/tournaments", tournamentRoutes);
api.route("/categories", categoryRoutes);
api.route("/matches", matchRoutes);
api.route("/admin", adminRoutes);

export type ApiType = typeof api;
