import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client";

async function main() {
  // eslint-disable-next-line no-console
  console.log("[svutt] Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  // eslint-disable-next-line no-console
  console.log("[svutt] Migrations done.");
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
