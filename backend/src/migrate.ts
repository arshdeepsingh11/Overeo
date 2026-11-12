/* Apply database migrations in order (migrations/NNN_name.sql). Safe to run on every start. */
import fs from "node:fs";
import path from "node:path";
import { db, openDb, closeDb } from "./db/db.js";

export async function migrate(dir = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "migrations"), log = console.log) {
  const q = db().query;
  await q(`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await q<{ version: string }>("SELECT version FROM schema_migrations")).rows.map((r) => r.version));
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const f of files) {
    const version = f.replace(/\.sql$/, "");
    if (done.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const c = await db().connect();
    try {
      await c.query("BEGIN");
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await c.query("COMMIT");
      c.release();
      log(`[migrate] applied ${version}`);
    } catch (e) {
      await c.query("ROLLBACK").catch(() => undefined);
      c.release(true);
      throw new Error(`Migration ${version} failed: ${(e as Error).message}`);
    }
  }
}

// `node dist/migrate.js` runs migrations and exits
if (process.argv[1] && /migrate\.(js|ts|mjs)$/.test(process.argv[1])) {
  openDb()
    .then(() => migrate())
    .then(() => closeDb())
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
