/* Passwords, PINs and tokens — node:crypto only. */
import crypto from "node:crypto";
import { promisify } from "node:util";
import { config } from "../config.js";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, o: crypto.ScryptOptions) => Promise<Buffer>;
// OWASP-recommended scrypt cost: N=2^17, r=8, p=1 (~128 MB·ms); PINs use the same to resist guessing
const N = 2 ** 17;
const R = 8;
const P = 1;
const MAXMEM = 256 * 1024 * 1024;

/** "scrypt$N$r$p$salt$hash" (base64) */
export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(secret.normalize("NFKC"), salt, 32, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(secret.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return crypto.timingSafeEqual(key, expected);
}

/** a hash that takes as long as a real check — used when the email doesn't exist */
let dummy: string | null = null;
export async function burnTime(secret: string) {
  dummy ??= await hashSecret("not-a-real-password");
  await verifySecret(secret, dummy);
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Short-lived proof that a PIN-locked profile was unlocked in this session. */
export function profileKey(sessionId: string, profileId: string, hours = 12) {
  const exp = Date.now() + hours * 3600_000;
  const sig = crypto.createHmac("sha256", config.secret).update(`${sessionId}.${profileId}.${exp}`).digest("base64url");
  return `${exp}.${sig}`;
}
export function checkProfileKey(key: string | undefined, sessionId: string, profileId: string) {
  if (!key) return false;
  const [exp, sig] = key.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac("sha256", config.secret).update(`${sessionId}.${profileId}.${exp}`).digest("base64url");
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
