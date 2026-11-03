import crypto from "node:crypto";

/* =====================================================================
   Web Push, with no third-party library (server only).

   - VAPID (RFC 8292): an ES256-signed JWT proves the message comes from
     OVEREO. Keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY
     (generate with: node scripts/vapid-keys.mjs).
   - Payload encryption (RFC 8291, aes128gcm / RFC 8188): only her
     browser can read the notification text; the push service can't.
   ===================================================================== */

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const b64u = {
  enc: (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
};

const hmac = (key: Buffer, data: Buffer) => crypto.createHmac("sha256", key).update(data).digest();

/** HKDF (RFC 5869) with a single output block — all we need here. */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, len: number) {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, len);
}

export function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "https://overeo.vercel.app";
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

/** The VAPID Authorization header for one push service. */
export function vapidHeader(endpoint: string, v: { publicKey: string; privateKey: string; subject: string }, now = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const header = b64u.enc(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.enc(Buffer.from(JSON.stringify({ aud, exp: now + 12 * 3600, sub: v.subject })));
  const pub = b64u.dec(v.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID public key must be an uncompressed P-256 point");
  const key = crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", d: v.privateKey, x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33, 65)) }, format: "jwk" });
  const sig = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u.enc(sig)}, k=${v.publicKey}`;
}

/** Encrypt a payload for one subscription (aes128gcm, single record). */
export function encrypt(sub: PushSub, payload: Buffer, opts: { salt?: Buffer; ecdh?: crypto.ECDH } = {}) {
  const uaPublic = b64u.dec(sub.keys.p256dh);
  const authSecret = b64u.dec(sub.keys.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("invalid subscription keys");
  const ecdh = opts.ecdh ?? crypto.createECDH("prime256v1");
  if (!opts.ecdh) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const salt = opts.salt ?? crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const rs = 4096;
  if (payload.length + 17 + 86 > rs) throw new Error("payload too large");
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21);
  salt.copy(head, 0);
  head.writeUInt32BE(rs, 16);
  head.writeUInt8(asPublic.length, 20);
  return Buffer.concat([head, asPublic, body]);
}

const ALLOWED_PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/;

export function validSubscription(x: unknown): x is PushSub {
  const s = x as PushSub;
  if (!s || typeof s.endpoint !== "string" || !s.keys || typeof s.keys.p256dh !== "string" || typeof s.keys.auth !== "string") return false;
  try {
    const u = new URL(s.endpoint);
    // only real push services — never an arbitrary URL (no server-side request forgery)
    return u.protocol === "https:" && ALLOWED_PUSH_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send one notification. `gone` means the subscription is dead and should be deleted. */
export async function sendPush(sub: PushSub, msg: PushMessage, opts: { ttl?: number; urgency?: "low" | "normal" | "high" } = {}) {
  const v = vapidConfig();
  if (!v) return { ok: false as const, status: 0, gone: false, reason: "not-configured" };
  const payload = Buffer.from(JSON.stringify({ title: msg.title.slice(0, 80), body: msg.body.slice(0, 240), url: msg.url && msg.url.startsWith("/") ? msg.url : "/app", tag: msg.tag?.slice(0, 64) }));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      authorization: vapidHeader(sub.endpoint, v),
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: String(opts.ttl ?? 86_400),
      urgency: opts.urgency ?? "normal",
    },
    body: new Uint8Array(encrypt(sub, payload)),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) return { ok: false as const, status: 0, gone: false, reason: "unreachable" };
  return { ok: res.status >= 200 && res.status < 300, status: res.status, gone: res.status === 404 || res.status === 410, reason: res.ok ? undefined : `push service ${res.status}` };
}
