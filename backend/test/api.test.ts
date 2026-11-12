/* End-to-end API tests against a real PostgreSQL. Run: npm test (needs TEST_DATABASE_URL). */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STORAGE = fs.mkdtempSync(path.join(os.tmpdir(), "overeo-files-"));
Object.assign(process.env, {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
  APP_SECRET: "test-secret-test-secret-test-secret-123",
  ALLOWED_ORIGINS: "http://localhost:3000",
  STORAGE_DIR: STORAGE,
  COOKIE_SECURE: "false",
});
const { openDb, db, closeDb } = await import("../src/db/db.js");
const { migrate } = await import("../src/migrate.js");
const { buildApp } = await import("../src/app.js");
const { outbox } = await import("../src/lib/mail.js");

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${m}`); };

await openDb();
await db().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await migrate(new URL("../migrations", import.meta.url).pathname, () => {});
const server = http.createServer(buildApp(() => {}));
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const B = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

/** a tiny browser: keeps cookies */
function client(origin = "http://localhost:3000") {
  let cookie = "";
  const keys: Record<string, string> = {};
  return {
    keys,
    async call(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
      const isBuf = Buffer.isBuffer(body);
      const res = await fetch(B + p, {
        method,
        headers: { ...(body !== undefined && !isBuf ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), origin, ...headers },
        body: body === undefined ? undefined : isBuf ? new Uint8Array(body as Buffer) : JSON.stringify(body),
      });
      const sc = res.headers.getSetCookie?.() ?? [];
      for (const s of sc) {
        const [kv] = s.split(";");
        cookie = kv.endsWith("=") ? "" : kv;
      }
      const ct = res.headers.get("content-type") ?? "";
      const data = ct.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
      return { status: res.status, data: data as any, headers: res.headers, setCookie: sc };
    },
    get cookie() { return cookie; },
  };
}

/* ---------------- health ---------------- */
{
  const r = await client().call("GET", "/v1/health");
  ok(r.status === 200 && r.data.ok && r.data.db === "builtin", "health check reaches the database");
  ok(r.headers.get("x-content-type-options") === "nosniff" && r.headers.get("x-frame-options") === "DENY", "security headers on every response");
}

/* ---------------- sign up / log in / log out ---------------- */
const amy = client();
{
  let r = await amy.call("POST", "/v1/auth/signup", { name: "Amy", email: "Amy@Example.com", password: "short" });
  ok(r.status === 422 && r.data.error.fields.password, "weak password is refused with a field message");
  r = await amy.call("POST", "/v1/auth/signup", { name: "Amy", email: "Amy@Example.com", password: "correct horse 7" });
  ok(r.status === 201 && r.data.user.email === "amy@example.com" && r.data.profiles.length === 1 && r.data.profiles[0].isPrimary && r.data.profiles[0].relation === "self", "sign up creates the account and her own profile");
  ok(r.setCookie.some((s: string) => /overeo_session=.+HttpOnly; SameSite=Lax/.test(s)), "session cookie is HttpOnly + SameSite");
  ok(outbox.some((m) => m.to === "amy@example.com" && /Confirm your email/.test(m.subject)), "a confirm-email message is prepared (logged until email is connected)");
  const pw = (await db().query<{ password_hash: string }>("SELECT password_hash FROM users")).rows[0].password_hash;
  ok(pw.startsWith("scrypt$") && !pw.includes("correct horse"), "password stored only as a scrypt hash");
  r = await client().call("POST", "/v1/auth/signup", { name: "X", email: "amy@EXAMPLE.com", password: "another pass 9" });
  ok(r.status === 409 && r.data.error.code === "email_taken", "same email can't sign up twice");
  r = await amy.call("GET", "/v1/auth/me");
  ok(r.status === 200 && r.data.user.name === "Amy", "signed in after sign-up");
  r = await amy.call("POST", "/v1/auth/logout", {});
  ok(r.status === 200 && amy.cookie === "", "log out clears the cookie");
  r = await amy.call("GET", "/v1/auth/me");
  ok(r.status === 401, "signed out → 401");
  r = await amy.call("GET", "/v1/auth/session");
  ok(r.status === 200 && r.data.user === null, "start-up check: signed out is a normal answer");
  r = await amy.call("POST", "/v1/auth/login", { email: "amy@example.com", password: "wrong one!" });
  ok(r.status === 401 && r.data.error.message === "Email or password is wrong.", "wrong password: plain message");
  r = await amy.call("POST", "/v1/auth/login", { email: "nobody@example.com", password: "wrong one!" });
  ok(r.status === 401 && r.data.error.message === "Email or password is wrong.", "unknown email: same message (no account guessing)");
  r = await amy.call("POST", "/v1/auth/login", { email: "AMY@example.com ", password: "correct horse 7" });
  ok(r.status === 200 && r.data.profiles.length === 1, "log in works (email in any case)");
}

/* ---------------- CSRF / CORS ---------------- */
{
  const evil = client("https://evil.example");
  const r = await evil.call("POST", "/v1/auth/login", { email: "amy@example.com", password: "correct horse 7" });
  ok(r.status === 403, "another website can't post to the API");
  const pre = await fetch(B + "/v1/auth/login", { method: "OPTIONS", headers: { origin: "http://localhost:3000", "access-control-request-method": "POST" } });
  ok(pre.status === 204 && pre.headers.get("access-control-allow-origin") === "http://localhost:3000" && pre.headers.get("access-control-allow-credentials") === "true", "our website is allowed (CORS)");
}

/* ---------------- family profiles ---------------- */
let mom = "";
let self = "";
{
  let r = await amy.call("GET", "/v1/profiles");
  self = r.data.profiles[0].id;
  r = await amy.call("POST", "/v1/profiles", { name: "Mom", relation: "mother", birthYear: 1968, lifeStage: "post", goals: ["menopause"], hue: 20, pin: "4321" });
  ok(r.status === 201 && r.data.profile.hasPin && r.data.profile.relation === "mother" && typeof r.data.key === "string", "add a family profile with a PIN");
  mom = r.data.profile.id;
  r = await amy.call("POST", "/v1/profiles", { name: "Me again", relation: "self" });
  ok(r.status === 422, "only one 'self' profile");
  r = await amy.call("POST", "/v1/profiles", { name: "Lily", relation: "daughter", birthYear: 2010, lifeStage: "cycling", goals: ["periods"] });
  ok(r.status === 201 && !r.data.profile.hasPin, "add a profile without a PIN");
  const lily = r.data.profile.id;
  r = await amy.call("GET", "/v1/profiles");
  ok(r.data.profiles.length === 3 && r.data.profiles[0].isPrimary, "three profiles, her own first");
  ok(!JSON.stringify(r.data).includes("pin_hash") && !JSON.stringify(r.data).includes("scrypt"), "PIN hashes never leave the server");

  r = await amy.call("GET", `/v1/profiles/${mom}/sync`);
  ok(r.status === 403 && r.data.error.code === "pin_required", "a PIN-locked profile needs its PIN");
  r = await amy.call("POST", `/v1/profiles/${mom}/unlock`, { pin: "0000" });
  ok(r.status === 401, "wrong PIN refused");
  r = await amy.call("POST", `/v1/profiles/${mom}/unlock`, { pin: "4321" });
  ok(r.status === 200 && r.data.key, "right PIN unlocks");
  amy.keys.mom = r.data.key;
  r = await amy.call("GET", `/v1/profiles/${mom}/sync`, undefined, { "x-profile-key": amy.keys.mom });
  ok(r.status === 200, "unlocked profile opens");
  r = await amy.call("GET", `/v1/profiles/${mom}/sync`, undefined, { "x-profile-key": amy.keys.mom.replace(/.$/, "x") });
  ok(r.status === 403, "a forged unlock key is refused");

  r = await amy.call("PATCH", `/v1/profiles/${lily}`, { name: "Lily R.", typicalCycle: 30 });
  ok(r.status === 200 && r.data.profile.name === "Lily R." && r.data.profile.typicalCycle === 30, "edit a profile");
  r = await amy.call("PATCH", `/v1/profiles/${self}`, { relation: "mother" });
  ok(r.status === 422, "her own profile stays 'self'");
  r = await amy.call("DELETE", `/v1/profiles/${self}`, { password: "correct horse 7" });
  ok(r.status === 409, "her own profile can't be deleted");
  r = await amy.call("DELETE", `/v1/profiles/${lily}`, { password: "nope nope" });
  ok(r.status === 401, "deleting a profile needs the password");
  r = await amy.call("DELETE", `/v1/profiles/${lily}`, { password: "correct horse 7" });
  ok(r.status === 200 && (await amy.call("GET", "/v1/profiles")).data.profiles.length === 2, "delete a family profile");
}

/* ---------------- another person can't see Amy's data ---------------- */
const bea = client();
{
  await bea.call("POST", "/v1/auth/signup", { name: "Bea", email: "bea@example.com", password: "bea password 1" });
  const r = await bea.call("GET", `/v1/profiles/${self}/sync`);
  ok(r.status === 404, "another account can't open Amy's profile");
  const r2 = await bea.call("POST", `/v1/profiles/${self}/sync`, { records: [] });
  ok(r2.status === 404, "…or write to it");
}

/* ---------------- sync ---------------- */
{
  const t0 = new Date(Date.now() - 60_000).toISOString();
  const rec = (id: string, type: string, value: unknown, updatedAt = t0) => ({ id, type, value, observedAt: t0, createdAt: t0, updatedAt, source: { origin: "manual", label: "You entered this" }, confirmationStatus: "confirmed", status: "active", history: [{ revisionNumber: 1, changedAt: t0, changedBy: "user", reason: "created" }], schemaVersion: 1 });
  let r = await amy.call("POST", `/v1/profiles/${self}/sync`, {
    records: [rec("r1", "period_start", { flow: 3 }), rec("r2", "mood", { score: 4, label: "Good" }), rec("r3", "lab_result", { testName: "AMH", value: 2.1, unit: "ng/mL", low: 1, high: 4 })],
    items: [
      { collection: "agents", id: "cycle", data: { enabled: true, never: ["no weekends"] }, updatedAt: t0 },
      { collection: "reminders", id: "rem1", data: { id: "rem1", title: "Iron tablet", due: t0, done: false }, updatedAt: t0 },
      { collection: "memory", id: "main", data: { overrides: [], told: [{ id: "m1", text: "I work nights" }] }, updatedAt: t0 },
    ],
  });
  ok(r.status === 200 && r.data.accepted.records === 3 && r.data.accepted.items === 3, "phone sends records and app state");
  r = await amy.call("GET", `/v1/profiles/${self}/sync`);
  const cursor = r.data.cursor;
  ok(r.data.records.length === 3 && r.data.records.find((x: any) => x.id === "r3").value.value === 2.1 && Array.isArray(r.data.records[0].history), "another device gets everything back, intact");
  ok(r.data.items.find((x: any) => x.collection === "memory").data.told[0].text === "I work nights", "memories are stored");
  r = await amy.call("GET", `/v1/profiles/${self}/sync?since=${encodeURIComponent(cursor)}`);
  ok(r.data.records.length === 0 && r.data.items.length === 0, "nothing new since the cursor");

  // an older edit must not overwrite a newer one
  const newer = new Date().toISOString();
  await amy.call("POST", `/v1/profiles/${self}/sync`, { records: [rec("r2", "mood", { score: 5, label: "Great" }, newer)] });
  r = await amy.call("POST", `/v1/profiles/${self}/sync`, { records: [rec("r2", "mood", { score: 1, label: "Low" }, t0)] });
  ok(r.data.ignored.records === 1, "an older edit from another phone is ignored");
  r = await amy.call("GET", `/v1/profiles/${self}/sync?since=${encodeURIComponent(cursor)}`);
  ok(r.data.records.length === 1 && r.data.records[0].value.score === 5, "the newest edit wins and is picked up by the cursor");
  // delete
  await amy.call("POST", `/v1/profiles/${self}/sync`, { records: [{ ...rec("r1", "period_start", { flow: 3 }, new Date().toISOString()), deleted: true }], items: [{ collection: "reminders", id: "rem1", data: null, updatedAt: new Date().toISOString(), deleted: true }] });
  r = await amy.call("GET", `/v1/profiles/${self}/sync?since=${encodeURIComponent(cursor)}`);
  ok(r.data.records.find((x: any) => x.id === "r1")?.deleted === true && r.data.records.find((x: any) => x.id === "r1")?.value.flow === 3 && r.data.items.find((x: any) => x.id === "rem1")?.deleted === true, "deletions sync to other devices (and keep the stored value)");
  // a phone clock far in the future can't lock a record forever
  await amy.call("POST", `/v1/profiles/${self}/sync`, { records: [rec("r9", "weight", { kg: 60 }, "2099-01-01T00:00:00Z")] });
  const stored = (await db().query<{ updated_at: Date }>("SELECT updated_at FROM records WHERE id = 'r9'")).rows[0].updated_at;
  ok(new Date(stored).getFullYear() < 2099, "a wrong future phone clock is clamped");
  r = await amy.call("POST", `/v1/profiles/${self}/sync`, { records: [{ ...rec("bad", "bitcoin", {}) }] });
  ok(r.status === 422, "unknown record types are refused");
  r = await amy.call("POST", `/v1/profiles/${self}/sync`, "not json" as unknown as object, { "content-type": "text/plain" });
  ok(r.status === 415 || r.status === 422, "non-JSON is refused");
  // profiles are separate
  r = await amy.call("GET", `/v1/profiles/${mom}/sync`, undefined, { "x-profile-key": amy.keys.mom });
  ok(r.data.records.length === 0, "Mom's profile doesn't see Amy's records");
}

/* ---------------- files ---------------- */
{
  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2000, 32), Buffer.from("\n%%EOF")]);
  let r = await amy.call("POST", `/v1/profiles/${self}/files`, pdf, { "content-type": "application/pdf", "x-file-name": encodeURIComponent("blood test ✓.pdf"), "x-client-id": "doc_1" });
  ok(r.status === 201 && r.data.file.size === pdf.length, "upload a lab report (PDF)");
  const fid = r.data.file.id;
  r = await amy.call("POST", `/v1/profiles/${self}/files`, pdf, { "content-type": "application/pdf", "x-client-id": "doc_1" });
  ok(r.data.file.duplicate === true, "the same file from the same phone isn't stored twice");
  r = await amy.call("POST", `/v1/profiles/${self}/files`, Buffer.from("MZ fake exe"), { "content-type": "application/pdf" });
  ok(r.status === 415, "a file pretending to be a PDF is refused");
  r = await amy.call("POST", `/v1/profiles/${self}/files`, Buffer.from("hello"), { "content-type": "text/html" });
  ok(r.status === 415, "other file types are refused");
  r = await amy.call("GET", `/v1/profiles/${self}/files/${fid}`);
  ok(r.status === 200 && Buffer.isBuffer(r.data) && r.data.equals(pdf) && /attachment/.test(r.headers.get("content-disposition") ?? ""), "download returns the exact file");
  r = await bea.call("GET", `/v1/profiles/${self}/files/${fid}`);
  ok(r.status === 404, "another account can't download it");
  r = await amy.call("GET", `/v1/profiles/${self}/files`);
  ok(r.data.files.length === 1 && r.data.files[0].name === "blood test _.pdf", "file list (unsafe characters in names are replaced)");
}

/* ---------------- conversations ---------------- */
{
  let r = await amy.call("POST", `/v1/profiles/${self}/messages`, { conversationId: "c1", kind: "si", title: "Next period", messages: [{ id: "m1", role: "user", text: "When is my next period?" }, { id: "m2", role: "assistant", agent: "cycle", text: "Around 14–16 Dec.", meta: { mode: "device" } }] });
  ok(r.status === 201, "save a chat");
  await amy.call("POST", `/v1/profiles/${self}/messages`, { conversationId: "c1", messages: [{ id: "m2", role: "assistant", text: "dup" }] });
  r = await amy.call("GET", `/v1/profiles/${self}/conversations/c1`);
  ok(r.data.messages.length === 2 && r.data.messages[1].agent === "cycle" && r.data.messages[1].text === "Around 14–16 Dec.", "chat history comes back in order, no duplicates");
  r = await amy.call("GET", `/v1/profiles/${self}/conversations`);
  ok(r.data.conversations[0].title === "Next period" && r.data.conversations[0].messages === 2, "conversation list");
}

/* ---------------- export ---------------- */
{
  const r = await amy.call("GET", `/v1/profiles/${self}/export`);
  ok(r.status === 200 && r.data.format === "overeo-export-v1" && r.data.records.length >= 2 && r.data.messages.length === 2 && r.data.files.length === 1, "export everything for one profile");
}

/* ---------------- sessions & password ---------------- */
{
  const phone = client();
  await phone.call("POST", "/v1/auth/login", { email: "amy@example.com", password: "correct horse 7" });
  let r = await amy.call("GET", "/v1/auth/sessions");
  ok(r.data.sessions.length >= 2 && r.data.sessions.some((s: any) => s.current), "she can see where she's signed in");
  r = await amy.call("POST", "/v1/auth/password", { current: "wrong", next: "brand new pass 2" });
  ok(r.status === 401, "change password needs the current one");
  r = await amy.call("POST", "/v1/auth/password", { current: "correct horse 7", next: "brand new pass 2" });
  ok(r.status === 200, "change password");
  ok((await phone.call("GET", "/v1/auth/me")).status === 401, "…which signs out her other devices");
  ok((await amy.call("GET", "/v1/auth/me")).status === 200, "…but not this one");
}

/* ---------------- forgot / reset ---------------- */
{
  const anon = client();
  let r = await anon.call("POST", "/v1/auth/forgot", { email: "amy@example.com" });
  const r2 = await anon.call("POST", "/v1/auth/forgot", { email: "ghost@example.com" });
  ok(r.status === 200 && r2.status === 200 && r.data.message === r2.data.message, "forgot password: same answer for any email");
  const mail = [...outbox].reverse().find((m) => /Reset/.test(m.subject))!;
  const token = mail.text.match(/token=([\w-]+)/)![1];
  r = await anon.call("POST", "/v1/auth/reset", { token, password: "reset pass 33" });
  ok(r.status === 200, "reset with the emailed link");
  r = await anon.call("POST", "/v1/auth/reset", { token, password: "reset pass 44" });
  ok(r.status === 400, "a reset link works only once");
  ok((await amy.call("GET", "/v1/auth/me")).status === 401, "reset signs out every device");
  r = await amy.call("POST", "/v1/auth/login", { email: "amy@example.com", password: "reset pass 33" });
  ok(r.status === 200, "log in with the new password");
}

/* ---------------- lockout & rate limits ---------------- */
{
  const att = client();
  await att.call("POST", "/v1/auth/signup", { name: "Cy", email: "cy@example.com", password: "cy password 1" });
  let last;
  for (let i = 0; i < 11; i++) last = await att.call("POST", "/v1/auth/login", { email: "cy@example.com", password: "guess " + i });
  ok(last!.status === 423 || last!.status === 429, `repeated wrong passwords lock the login (${last!.status})`);
  const k = client();
  const r = await k.call("POST", "/v1/auth/login", { email: "cy@example.com", password: "cy password 1" });
  ok(r.status === 423 || r.status === 429, "…even with the right password, for a while");
}

/* ---------------- delete account ---------------- */
{
  let r = await amy.call("DELETE", "/v1/account", { password: "wrong" });
  ok(r.status === 401, "deleting the account needs the password");
  r = await amy.call("DELETE", "/v1/account", { password: "reset pass 33" });
  ok(r.status === 200, "delete account");
  const left = (await db().query<{ n: number }>("SELECT (SELECT count(*) FROM users WHERE lower(email)='amy@example.com') + (SELECT count(*) FROM profiles p WHERE p.id = $1) + (SELECT count(*) FROM records WHERE profile_id = $1) + (SELECT count(*) FROM messages WHERE profile_id = $1) AS n", [self])).rows[0].n;
  ok(Number(left) === 0, "all her data is gone from the database");
  ok(fs.readdirSync(STORAGE, { recursive: true }).filter((f) => String(f).endsWith(".pdf")).length === 0, "her files are gone from storage");
  ok((await bea.call("GET", "/v1/auth/me")).status === 200, "other accounts are untouched");
}

/* ---------------- odds and ends ---------------- */
{
  const r = await client().call("GET", "/v1/nope");
  ok(r.status === 404 && r.data.error.code === "not_found", "unknown route: 404 JSON");
  const big = await client().call("POST", "/v1/auth/login", { email: "a@b.c", password: "x".repeat(3_000_000) });
  ok(big.status === 413, "oversized requests are refused");
  const audits = (await db().query<{ action: string }>("SELECT DISTINCT action FROM audit_log")).rows.map((x) => x.action);
  ok(["signup", "login", "login_failed", "logout", "profile_created", "profile_deleted", "password_changed", "profile_exported", "account_deleted"].every((a) => audits.includes(a)), "audit log records the important events");
}

server.close();
await closeDb();
fs.rmSync(STORAGE, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
