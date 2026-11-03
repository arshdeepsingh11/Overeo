#!/usr/bin/env node
// Generate a VAPID key pair for Web Push (closed-app notifications).
//   node scripts/vapid-keys.mjs
// Put the output in .env.local (and in Vercel → Environment Variables).
// Keep VAPID_PRIVATE_KEY and PUSH_SEND_SECRET secret — never NEXT_PUBLIC_.
import crypto from "node:crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
const pub = publicKey.export({ format: "jwk" });
const b = (s) => Buffer.from(s, "base64url");
const raw = Buffer.concat([Buffer.from([4]), b(pub.x), b(pub.y)]).toString("base64url");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${raw}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`VAPID_SUBJECT=https://overeo.vercel.app`);
console.log(`PUSH_SEND_SECRET=${crypto.randomBytes(32).toString("base64url")}`);
