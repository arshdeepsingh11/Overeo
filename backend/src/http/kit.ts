/* =====================================================================
   A small HTTP toolkit on node:http — routing, JSON, cookies, errors,
   security headers, CORS and rate limits. No framework, so nothing to
   keep patched and nothing hidden.
   ===================================================================== */

import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { ZodError, type ZodTypeAny, type infer as Infer } from "zod";
import { config } from "../config.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message ?? code);
  }
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  ip: string;
  id: string;
  /** set by requireUser */
  user?: { id: string; email: string; name: string; sessionId: string };
  status: number;
  headers: Record<string, string | string[]>;
}

type Handler = (c: Ctx) => Promise<unknown> | unknown;
interface Route {
  method: string;
  re: RegExp;
  keys: string[];
  h: Handler;
}

export class Router {
  routes: Route[] = [];
  on(method: string, path: string, h: Handler) {
    const keys: string[] = [];
    const re = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$");
    this.routes.push({ method, re, keys, h });
    return this;
  }
  get = (p: string, h: Handler) => this.on("GET", p, h);
  post = (p: string, h: Handler) => this.on("POST", p, h);
  patch = (p: string, h: Handler) => this.on("PATCH", p, h);
  put = (p: string, h: Handler) => this.on("PUT", p, h);
  delete = (p: string, h: Handler) => this.on("DELETE", p, h);
  match(method: string, path: string) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = path.match(r.re);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { h: r.h, params };
    }
    return pathMatched ? "method" : null;
  }
}

/* ---------------------------------- body ---------------------------------- */

export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const len = Number(req.headers["content-length"] ?? 0);
  if (len > limit) throw new HttpError(413, "too_large", "That is too large.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new HttpError(413, "too_large", "That is too large.");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function body<S extends ZodTypeAny>(c: Ctx, schema: S, limit = 2_000_000): Promise<Infer<S>> {
  const ct = String(c.req.headers["content-type"] ?? "");
  if (!ct.includes("application/json")) throw new HttpError(415, "json_required", "Send JSON.");
  const raw = await readBody(c.req, limit);
  let data: unknown;
  try {
    data = raw.length ? JSON.parse(raw.toString("utf8")) : {};
  } catch {
    throw new HttpError(400, "bad_json", "That isn't valid JSON.");
  }
  return parse(schema, data);
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): Infer<S> {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      const fields = Object.fromEntries(e.issues.map((i) => [i.path.join(".") || "body", i.message]));
      throw new HttpError(422, "invalid", "Please check the highlighted fields.", { fields });
    }
    throw e;
  }
}

/* --------------------------------- cookies --------------------------------- */

export function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(c: Ctx, name: string, value: string, maxAgeSec: number) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (config.cookieSecure) parts.push("Secure");
  if (config.cookieDomain) parts.push(`Domain=${config.cookieDomain}`);
  const prev = c.headers["set-cookie"];
  c.headers["set-cookie"] = [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join("; ")];
}

/* ------------------------------- rate limits ------------------------------- */

const buckets = new Map<string, { n: number; reset: number }>();
/** Fixed window: `max` hits per `windowSec` for `key`. */
export function limit(key: string, max: number, windowSec: number) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { n: 0, reset: now + windowSec * 1000 };
    buckets.set(key, b);
  }
  b.n++;
  if (buckets.size > 50_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  if (b.n > max) throw new HttpError(429, "slow_down", "Too many tries. Please wait a minute and try again.", { retryAfter: Math.ceil((b.reset - now) / 1000) });
}

/* --------------------------------- serving --------------------------------- */

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-site",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cache-control": "no-store",
};

function clientIp(req: IncomingMessage) {
  if (config.trustProxy) {
    const f = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    if (f) return f;
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function handler(router: Router, log = (l: Record<string, unknown>) => console.log(JSON.stringify(l))) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const started = Date.now();
    const url = new URL(req.url ?? "/", "http://x");
    const c: Ctx = { req, res, url, params: {}, ip: clientIp(req), id: crypto.randomUUID(), status: 200, headers: { ...SECURITY_HEADERS, "x-request-id": "" } };
    c.headers["x-request-id"] = c.id;
    const origin = String(req.headers.origin ?? "");
    const allowed = origin && config.allowedOrigins.includes(origin);
    if (allowed) {
      c.headers["access-control-allow-origin"] = origin;
      c.headers["access-control-allow-credentials"] = "true";
      c.headers["vary"] = "Origin";
    }
    let out: unknown = null;
    try {
      if (req.method === "OPTIONS") {
        if (!allowed) throw new HttpError(403, "origin_not_allowed");
        c.headers["access-control-allow-methods"] = "GET,POST,PATCH,PUT,DELETE";
        c.headers["access-control-allow-headers"] = "content-type,authorization,x-profile-key,x-file-name,x-client-id";
        c.headers["access-control-max-age"] = "600";
        c.status = 204;
      } else {
        // cookie-authenticated writes must come from our own site (CSRF protection)
        if (req.method !== "GET" && req.method !== "HEAD" && origin && !allowed) throw new HttpError(403, "origin_not_allowed", "This site isn't allowed to change OVEREO data.");
        const m = router.match(req.method ?? "GET", url.pathname);
        if (m === null) throw new HttpError(404, "not_found", "Not found.");
        if (m === "method") throw new HttpError(405, "method_not_allowed");
        c.params = m.params;
        out = await m.h(c);
      }
    } catch (e) {
      if (e instanceof HttpError) {
        c.status = e.status;
        out = { error: { code: e.code, message: e.message, ...e.extra } };
        if (e.status === 429 && e.extra?.retryAfter) c.headers["retry-after"] = String(e.extra.retryAfter);
      } else {
        c.status = 500;
        out = { error: { code: "server_error", message: "Something went wrong on our side. Please try again." } };
        log({ level: "error", id: c.id, path: url.pathname, err: (e as Error).stack ?? String(e) });
      }
    }
    if (!res.headersSent) {
      if (Buffer.isBuffer(out)) {
        res.writeHead(c.status, c.headers);
        res.end(out);
      } else if (c.status === 204 || out === undefined) {
        res.writeHead(c.status === 200 ? 204 : c.status, c.headers);
        res.end();
      } else {
        res.writeHead(c.status, { ...c.headers, "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(out));
      }
    }
    log({ level: "info", id: c.id, m: req.method, path: url.pathname, s: c.status, ms: Date.now() - started });
  };
}
