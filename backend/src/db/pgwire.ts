/* =====================================================================
   A small, dependency-free PostgreSQL client (wire protocol v3).

   Used when the `pg` package isn't installed. It supports what the
   OVEREO backend needs: SCRAM-SHA-256 / md5 / trust auth, TLS
   (sslmode=require), parameterised queries (extended protocol),
   transactions on a dedicated connection, and a small pool.
   Values are returned the same way `pg` returns them: int2/int4/float
   → number, int8/numeric → string, bool → boolean, json/jsonb → parsed,
   timestamp/timestamptz/date → Date, arrays of text → string[].
   ===================================================================== */

import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export class PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  constructor(fields: Record<string, string>) {
    super(fields.M ?? "Postgres error");
    this.code = fields.C;
    this.detail = fields.D;
    this.constraint = fields.n;
  }
}

interface ConnOpts {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | "require" | "verify";
}

export function parseUrl(url: string): ConnOpts {
  const u = new URL(url);
  const mode = u.searchParams.get("sslmode");
  return {
    host: u.hostname || "localhost",
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || "postgres"),
    password: decodeURIComponent(u.password || ""),
    database: decodeURIComponent(u.pathname.replace(/^\//, "") || "postgres"),
    ssl: mode === "require" || mode === "prefer" ? "require" : mode === "verify-full" || mode === "verify-ca" ? "verify" : false,
  };
}

/* ------------------------------ value parsing ------------------------------ */

const NUM = new Set([21, 23, 700, 701, 26]); // int2 int4 float4 float8 oid
const DATES = new Set([1082, 1114, 1184]);
function parseArray(s: string): (string | null)[] {
  // text[] / varchar[] — handles quotes and NULL
  if (s === "{}") return [];
  const out: (string | null)[] = [];
  let i = 1;
  while (i < s.length - 1) {
    if (s[i] === '"') {
      let v = "";
      i++;
      while (s[i] !== '"') {
        if (s[i] === "\\") i++;
        v += s[i++];
      }
      out.push(v);
      i += 2;
    } else {
      let j = i;
      while (s[j] !== "," && j < s.length - 1) j++;
      const v = s.slice(i, j);
      out.push(v === "NULL" ? null : v);
      i = j + 1;
    }
  }
  return out;
}
function parseValue(oid: number, raw: string): unknown {
  if (NUM.has(oid)) return Number(raw);
  if (oid === 16) return raw === "t";
  if (oid === 114 || oid === 3802) return JSON.parse(raw);
  if (DATES.has(oid)) return new Date(oid === 1114 ? raw.replace(" ", "T") + "Z" : oid === 1082 ? raw + "T00:00:00Z" : raw.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  if (oid === 1009 || oid === 1015) return parseArray(raw);
  if (oid === 1007) return parseArray(raw).map((x) => (x === null ? null : Number(x)));
  if (oid === 17) return Buffer.from(raw.slice(2), "hex"); // bytea hex
  return raw;
}

function serialize(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return "\\x" + v.toString("hex");
  if (Array.isArray(v)) return "{" + v.map((x) => (x === null ? "NULL" : '"' + String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"')).join(",") + "}";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/* -------------------------------- connection -------------------------------- */

class Writer {
  private parts: Buffer[] = [];
  str(s: string) {
    this.parts.push(Buffer.from(s + "\0", "utf8"));
    return this;
  }
  i32(n: number) {
    const b = Buffer.alloc(4);
    b.writeInt32BE(n);
    this.parts.push(b);
    return this;
  }
  i16(n: number) {
    const b = Buffer.alloc(2);
    b.writeInt16BE(n);
    this.parts.push(b);
    return this;
  }
  bytes(b: Buffer) {
    this.parts.push(b);
    return this;
  }
  msg(type: string | null): Buffer {
    const body = Buffer.concat(this.parts);
    const len = Buffer.alloc(4);
    len.writeInt32BE(body.length + 4);
    return type ? Buffer.concat([Buffer.from(type), len, body]) : Buffer.concat([len, body]);
  }
}

type Msg = { type: string; body: Buffer };

export class Connection {
  private sock!: net.Socket | tls.TLSSocket;
  private buf: Buffer = Buffer.alloc(0);
  private waiters: ((m: Msg) => void)[] = [];
  private queue: Msg[] = [];
  private closed = false;
  private chain: Promise<unknown> = Promise.resolve();
  broken = false;

  constructor(private o: ConnOpts) {}

  async connect() {
    let sock: net.Socket | tls.TLSSocket = net.connect({ host: this.o.host, port: this.o.port });
    await new Promise<void>((res, rej) => {
      sock.once("connect", res);
      sock.once("error", rej);
    });
    if (this.o.ssl) {
      sock.write(new Writer().i32(80877103).msg(null));
      const answer = await new Promise<string>((res) => sock.once("data", (d: Buffer) => res(d.toString("utf8", 0, 1))));
      if (answer !== "S") throw new Error("The database server does not accept SSL");
      sock = tls.connect({ socket: sock as net.Socket, servername: this.o.host, rejectUnauthorized: this.o.ssl === "verify" });
      await new Promise<void>((res, rej) => {
        (sock as tls.TLSSocket).once("secureConnect", res);
        sock.once("error", rej);
      });
    }
    this.sock = sock;
    sock.on("data", (d: Buffer) => this.onData(d));
    sock.on("error", () => this.fail());
    sock.on("close", () => this.fail());
    sock.write(new Writer().i32(196608).str("user").str(this.o.user).str("database").str(this.o.database).str("client_encoding").str("UTF8").str("TimeZone").str("UTC").str("DateStyle").str("ISO, MDY").str("").msg(null));
    await this.auth();
  }

  private fail() {
    this.broken = true;
    this.closed = true;
    const e: Msg = { type: "!", body: Buffer.alloc(0) };
    this.waiters.splice(0).forEach((w) => w(e));
  }

  private onData(d: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const m = { type: String.fromCharCode(this.buf[0]), body: this.buf.subarray(5, len + 1) };
      this.buf = this.buf.subarray(len + 1);
      if (m.type === "N" || m.type === "S" || m.type === "A") continue; // notices, parameter status, notifications
      const w = this.waiters.shift();
      if (w) w(m);
      else this.queue.push(m);
    }
  }

  private next(): Promise<Msg> {
    const m = this.queue.shift();
    if (m) return Promise.resolve(m);
    if (this.closed) return Promise.reject(new Error("Database connection closed"));
    return new Promise((res) => this.waiters.push(res)).then((x) => {
      const msg = x as Msg;
      if (msg.type === "!") throw new Error("Database connection closed");
      return msg;
    });
  }

  private static fields(body: Buffer) {
    const f: Record<string, string> = {};
    let i = 0;
    while (i < body.length && body[i] !== 0) {
      const k = String.fromCharCode(body[i]);
      const end = body.indexOf(0, i + 1);
      f[k] = body.toString("utf8", i + 1, end);
      i = end + 1;
    }
    return f;
  }

  private async auth() {
    for (;;) {
      const m = await this.next();
      if (m.type === "E") throw new PgError(Connection.fields(m.body));
      if (m.type === "Z") return;
      if (m.type === "K") continue;
      if (m.type !== "R") continue;
      const kind = m.body.readInt32BE(0);
      if (kind === 0) continue; // ok
      if (kind === 3) this.sock.write(new Writer().str(this.o.password).msg("p"));
      else if (kind === 5) {
        const salt = m.body.subarray(4, 8);
        const inner = crypto.createHash("md5").update(this.o.password + this.o.user).digest("hex");
        const outer = "md5" + crypto.createHash("md5").update(Buffer.concat([Buffer.from(inner), salt])).digest("hex");
        this.sock.write(new Writer().str(outer).msg("p"));
      } else if (kind === 10) await this.scram();
      else throw new Error(`Unsupported database auth method ${kind}`);
    }
  }

  private async scram() {
    const nonce = crypto.randomBytes(18).toString("base64");
    const first = `n=*,r=${nonce}`;
    const init = Buffer.from("n,," + first);
    this.sock.write(new Writer().str("SCRAM-SHA-256").i32(init.length).bytes(init).msg("p"));
    const c = await this.next();
    if (c.type === "E") throw new PgError(Connection.fields(c.body));
    const server = c.body.subarray(4).toString();
    const p = Object.fromEntries(server.split(",").map((x) => [x[0], x.slice(2)]));
    if (!p.r?.startsWith(nonce)) throw new Error("SCRAM: bad server nonce");
    const salted = crypto.pbkdf2Sync(this.o.password.normalize("NFKC"), Buffer.from(p.s, "base64"), Number(p.i), 32, "sha256");
    const hmac = (k: Buffer, s: string) => crypto.createHmac("sha256", k).update(s).digest();
    const clientKey = hmac(salted, "Client Key");
    const stored = crypto.createHash("sha256").update(clientKey).digest();
    const finalNoProof = `c=biws,r=${p.r}`;
    const authMsg = `${first},${server},${finalNoProof}`;
    const sig = hmac(stored, authMsg);
    const proof = Buffer.from(clientKey.map((b, i) => b ^ sig[i])).toString("base64");
    const serverSig = hmac(hmac(salted, "Server Key"), authMsg).toString("base64");
    this.sock.write(new Writer().bytes(Buffer.from(`${finalNoProof},p=${proof}`)).msg("p"));
    const f = await this.next();
    if (f.type === "E") throw new PgError(Connection.fields(f.body));
    const v = f.body.subarray(4).toString();
    if (v !== `v=${serverSig}`) throw new Error("SCRAM: server signature mismatch");
  }

  /** One query at a time per connection (queued). */
  query<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    const run = this.chain.then(() => this.run<T>(text, values));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async run<T>(text: string, values: unknown[]): Promise<QueryResult<T>> {
    if (this.closed) throw new Error("Database connection closed");
    // like `pg`: no parameters → simple protocol (allows several statements, e.g. migrations)
    if (!values.length) this.sock.write(new Writer().str(text).msg("Q"));
    else this.extended(text, values);
    return this.collect<T>();
  }

  private extended(text: string, values: unknown[]) {
    const params = values.map(serialize);
    const bind = new Writer().str("").str("").i16(0).i16(params.length);
    for (const p of params) {
      if (p === null) bind.i32(-1);
      else {
        const b = Buffer.from(p, "utf8");
        bind.i32(b.length).bytes(b);
      }
    }
    bind.i16(0);
    this.sock.write(
      Buffer.concat([
        new Writer().str("").str(text).i16(0).msg("P"),
        bind.msg("B"),
        new Writer().bytes(Buffer.from([0x50])).str("").msg("D"),
        new Writer().str("").i32(0).msg("E"),
        new Writer().msg("S"),
      ]),
    );
  }

  private async collect<T>(): Promise<QueryResult<T>> {
    let cols: { name: string; oid: number }[] = [];
    const rows: T[] = [];
    let rowCount = 0;
    let err: PgError | null = null;
    for (;;) {
      const m = await this.next();
      switch (m.type) {
        case "T": {
          const n = m.body.readInt16BE(0);
          let i = 2;
          cols = [];
          for (let k = 0; k < n; k++) {
            const end = m.body.indexOf(0, i);
            const name = m.body.toString("utf8", i, end);
            i = end + 1;
            const oid = m.body.readInt32BE(i + 6);
            cols.push({ name, oid });
            i += 18;
          }
          break;
        }
        case "D": {
          const n = m.body.readInt16BE(0);
          let i = 2;
          const row: Record<string, unknown> = {};
          for (let k = 0; k < n; k++) {
            const len = m.body.readInt32BE(i);
            i += 4;
            if (len === -1) row[cols[k].name] = null;
            else {
              row[cols[k].name] = parseValue(cols[k].oid, m.body.toString("utf8", i, i + len));
              i += len;
            }
          }
          rows.push(row as T);
          break;
        }
        case "C": {
          const tag = m.body.toString("utf8", 0, m.body.length - 1);
          const n = Number(tag.split(" ").pop());
          rowCount = Number.isFinite(n) ? n : rows.length;
          break;
        }
        case "E":
          err = new PgError(Connection.fields(m.body));
          break;
        case "Z":
          if (err) throw err;
          return { rows, rowCount };
        default:
          break; // 1 ParseComplete, 2 BindComplete, n NoData, I EmptyQuery
      }
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.sock.write(new Writer().msg("X"));
      this.sock.end();
    } catch {}
  }
}

/* ----------------------------------- pool ----------------------------------- */

export class Pool {
  private idle: Connection[] = [];
  private all = new Set<Connection>();
  private waiting: { res: (c: Connection) => void; rej: (e: unknown) => void }[] = [];
  private o: ConnOpts;
  constructor(url: string, private max = 10) {
    this.o = parseUrl(url);
  }

  async connect(): Promise<{ query: Connection["query"]; release: (destroy?: boolean) => void }> {
    let c = this.idle.pop();
    while (c && c.broken) {
      this.all.delete(c);
      c = this.idle.pop();
    }
    if (!c) {
      if (this.all.size < this.max) {
        c = new Connection(this.o);
        this.all.add(c);
        try {
          await c.connect();
        } catch (e) {
          this.all.delete(c);
          throw e;
        }
      } else c = await new Promise<Connection>((res, rej) => this.waiting.push({ res, rej }));
    }
    const conn = c;
    let released = false;
    return {
      query: conn.query.bind(conn) as Connection["query"],
      release: (destroy = false) => {
        if (released) return;
        released = true;
        if (destroy || conn.broken) {
          this.all.delete(conn);
          conn.close();
          const w = this.waiting.shift();
          if (w) {
            // replace the broken connection for whoever is waiting
            const fresh = new Connection(this.o);
            this.all.add(fresh);
            fresh.connect().then(
              () => w.res(fresh),
              (e) => {
                this.all.delete(fresh);
                w.rej(e);
              },
            );
          }
          return;
        }
        const w = this.waiting.shift();
        if (w) w.res(conn);
        else this.idle.push(conn);
      },
    };
  }

  async query<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    const c = await this.connect();
    try {
      const r = await c.query<T>(text, values);
      c.release();
      return r;
    } catch (e) {
      c.release(!(e instanceof PgError));
      throw e;
    }
  }

  async end() {
    for (const c of this.all) c.close();
    this.all.clear();
    this.idle = [];
  }
}
