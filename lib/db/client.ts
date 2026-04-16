import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __svuttPg: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== "test") {
  // Defer throwing until someone actually uses the DB so that pure unit tests
  // can import schema types without a live database.
  // eslint-disable-next-line no-console
  console.warn("[svutt] DATABASE_URL is not set — DB queries will fail.");
}

const client =
  global.__svuttPg ??
  postgres(connectionString ?? "postgres://localhost/svutt_invalid", {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__svuttPg = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
