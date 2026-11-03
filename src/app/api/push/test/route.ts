import { sendPush, validSubscription, vapidConfig } from "@/server/webpush";

/* =====================================================================
   POST /api/push/test — send her a test notification, so she can check
   that reminders reach her even when OVEREO is closed.
   Body: { subscription, discreet?, delay? (seconds, max 8) }
   ===================================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const xs = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  xs.push(now);
  hits.set(ip, xs);
  if (hits.size > 5000) hits.clear();
  return xs.length > 5;
}

export async function POST(req: Request) {
  if (!vapidConfig()) return json({ ok: false, reason: "not-configured" }, 503);
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(ip)) return json({ ok: false, reason: "rate-limited" }, 429);
  const body = (await req.json().catch(() => null)) as { subscription?: unknown; discreet?: boolean; delay?: number } | null;
  if (!body || !validSubscription(body.subscription)) return json({ ok: false, reason: "bad-subscription" }, 400);
  const delay = Math.max(0, Math.min(8, Number(body.delay) || 0));
  if (delay) await new Promise((r) => setTimeout(r, delay * 1000));
  const r = await sendPush(body.subscription, body.discreet ? { title: "OVEREO", body: "This is a test notification.", tag: "test" } : { title: "OVEREO reminders are on", body: "Notifications reach you even when OVEREO is closed.", tag: "test" }, { ttl: 300, urgency: "high" });
  return json({ ok: r.ok, gone: r.gone, reason: r.reason }, r.ok ? 200 : 502);
}
