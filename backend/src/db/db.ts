/* =====================================================================
   Database access — one tiny interface for the whole backend:
     db.query(sql, params)        → { rows, rowCount }
     db.tx(async (q) => { ... })  → runs inside a transaction
   Uses the `pg` package when it is installed (recommended in
   production), otherwise OVEREO's built-in client (src/db/pgwire.ts).
   Plain PostgreSQL SQL only, so the database can move to any Postgres
   host (own server, Supabase, Neon, RDS, Cloud SQL…) with a dump/restore.
   ===================================================================== */

import { Pool as WirePool, type QueryResult } from "./pgwire.js";

export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;

interface Driver {
  query: Query;
  connect(): Promise<{ query: Query; release: (destroy?: boolean) => void }>;
  end(): Promise<void>;
  name: string;
}

let driver: Driver | null = null;

export async function openDb(url = process.env.DATABASE_URL, max = Number(process.env.DB_POOL_MAX ?? 10)): Promise<Driver> {
  if (driver) return driver;
  if (!url) throw new Error("DATABASE_URL is not set");
  const want = process.env.OVEREO_DB_DRIVER ?? "auto";
  if (want !== "builtin") {
    try {
      const mod = (await import("pg" as string)) as { default?: { Pool: new (o: object) => unknown }; Pool?: new (o: object) => unknown };
      const PgPool = (mod.default?.Pool ?? mod.Pool)!;
      const ssl = /sslmode=(require|verify-full|verify-ca|prefer)/.test(url) ? { rejectUnauthorized: /verify-/.test(url) } : undefined;
      const pool = new PgPool({ connectionString: url, max, ssl }) as {
        query: Query;
        connect(): Promise<{ query: Query; release: (e?: boolean) => void }>;
        end(): Promise<void>;
        on(ev: string, f: (e: Error) => void): void;
      };
      pool.on("error", (e) => console.error("[db] idle client error", e.message));
      await pool.query("SET TIME ZONE 'UTC'");
      driver = { query: pool.query.bind(pool), connect: () => pool.connect(), end: () => pool.end(), name: "pg" };
      return driver;
    } catch (e) {
      if (want === "pg") throw e;
    }
  }
  const pool = new WirePool(url, max);
  driver = { query: pool.query.bind(pool) as Query, connect: () => pool.connect() as never, end: () => pool.end(), name: "builtin" };
  return driver;
}

export function db(): Driver {
  if (!driver) throw new Error("Database not opened");
  return driver;
}

/** Run `fn` in one transaction; rolls back on any error. */
export async function tx<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c.query);
    await c.query("COMMIT");
    c.release();
    return out;
  } catch (e) {
    try {
      await c.query("ROLLBACK");
      c.release();
    } catch {
      c.release(true);
    }
    throw e;
  }
}

export async function closeDb() {
  await driver?.end();
  driver = null;
}
