import { openDb, db, tx, closeDb } from "../src/db/db.js";
import { migrate } from "../src/migrate.js";
let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${m}`); };
await openDb(process.env.DATABASE_URL);
ok(db().name === "builtin", "built-in driver in use (pg not installed here)");
const r = await db().query<{ n: number; t: string; b: boolean; j: { a: number }; d: Date; big: string; arr: string[] }>("SELECT 1::int AS n, $1::text AS t, true AS b, '{\"a\":2}'::jsonb AS j, now() AS d, 9007199254740993::int8 AS big, ARRAY['x','y z','q\"r']::text[] AS arr", ["héllo ✓"]);
const row = r.rows[0];
ok(row.n === 1 && row.t === "héllo ✓" && row.b === true && row.j.a === 2 && row.d instanceof Date && !isNaN(+row.d) && row.big === "9007199254740993", "types parsed like pg");
ok(JSON.stringify(row.arr) === JSON.stringify(["x", "y z", 'q"r']), "text[] parsed");
let err: any; try { await db().query("SELECT * FROM nope"); } catch (e) { err = e; }
ok(err?.code === "42P01", "errors carry the Postgres code");
ok((await db().query("SELECT 2 AS x")).rows[0].x === 2, "connection still usable after an error");
await db().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await migrate(new URL("../migrations", import.meta.url).pathname, () => {});
await migrate(new URL("../migrations", import.meta.url).pathname, () => {});
const tables = (await db().query<{ t: string }>("SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' ORDER BY 1")).rows.map((x) => x.t);
ok(["audit_log","conversations","email_tokens","files","items","messages","profiles","push_subscriptions","records","schema_migrations","sessions","users"].every((t) => tables.includes(t)), `migrations applied, idempotent: ${tables.join(",")}`);
await tx(async (q) => { await q("INSERT INTO users (email,password_hash,name) VALUES ('a@b.c','x','A')"); });
let txErr; try { await tx(async (q) => { await q("INSERT INTO users (email,password_hash,name) VALUES ('t@b.c','x','T')"); throw new Error("boom"); }); } catch (e) { txErr = e; }
ok(txErr && (await db().query("SELECT count(*)::int AS n FROM users WHERE email='t@b.c'")).rows[0].n === 0, "transactions roll back on error");
let dup: any; try { await db().query("INSERT INTO users (email,password_hash,name) VALUES ('A@B.C','x','A2')"); } catch (e) { dup = e; }
ok(dup?.code === "23505", "emails are unique regardless of case");
// concurrency through the pool
const many = await Promise.all(Array.from({ length: 40 }, (_, i) => db().query<{ v: number }>("SELECT $1::int + 1 AS v", [i])));
ok(many.every((m, i) => m.rows[0].v === i + 1), "40 parallel queries through the pool return the right rows");
await closeDb();
console.log(`\n${pass} passed, ${fail} failed`);
