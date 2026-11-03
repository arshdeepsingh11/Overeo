import { sendPush, validSubscription, vapidConfig } from "@/server/webpush";

/* =====================================================================
   POST /api/push/send — for OVEREO's backend scheduler only.

   The backend stores each subscription with her upcoming reminders and,
   when one is due, calls this with the shared secret:
     Authorization: Bearer <PUSH_SEND_SECRET>
     { subscription, title, body, url?, tag? }
   Answers { ok, gone } — "gone" means delete that subscription.
   ===================================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function POST(req: Request) {
  const secret = process.env.PUSH_SEND_SECRET || "";
  if (!secret || !vapidConfig()) return json({ ok: false, reason: "not-configured" }, 503);
  const auth = req.headers.get("authorization") ?? "";
  if (!sameSecret(auth, `Bearer ${secret}`)) return json({ ok: false, reason: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { subscription?: unknown; title?: string; body?: string; url?: string; tag?: string } | null;
  if (!b || !validSubscription(b.subscription) || typeof b.title !== "string" || typeof b.body !== "string") return json({ ok: false, reason: "bad-request" }, 400);
  const r = await sendPush(b.subscription, { title: b.title, body: b.body, url: b.url, tag: b.tag });
  return json({ ok: r.ok, gone: r.gone, reason: r.reason }, r.ok ? 200 : r.gone ? 410 : 502);
}
