import { load, save } from "./db";
import { getSession } from "../auth/otp";
import type { Reminder } from "./types";

/* =====================================================================
   Notifications when OVEREO is closed (Web Push).

   - Her browser creates a private push address; OVEREO's server signs
     every message (VAPID) and encrypts it so only her device can read it.
   - "Send a test" works today: it goes through the real push service, so
     she can close the app and see it arrive.
   - Reminders at their exact time need the backend to remember them
     (it calls /api/push/send when one is due). When the backend is on,
     her subscription and upcoming reminders sync to it automatically.
   - iPhone: works for OVEREO added to the Home Screen (iOS 16.4+).
   ===================================================================== */

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const BACKEND = process.env.NEXT_PUBLIC_DATA_BACKEND === "rest" && !!API;
const DEVICE = "device";

export const pushConfigured = !!VAPID;

export function pushSupport(): { ok: boolean; why?: string } {
  if (typeof window === "undefined") return { ok: false, why: "server" };
  if (!VAPID) return { ok: false, why: "Closed-app notifications aren't switched on for this site yet." };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return { ok: false, why: "On iPhone, first add OVEREO to your Home Screen (Share → Add to Home Screen), then open it from there." };
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { ok: false, why: "This browser can't receive notifications when OVEREO is closed." };
  if (location.protocol !== "https:" && location.hostname !== "localhost") return { ok: false, why: "Notifications need a secure (https) connection." };
  return { ok: true };
}

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const savedSubscription = () => load<PushSubscriptionJSON | null>(DEVICE, "push", null);

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Ask permission (if needed) and create her push subscription. */
export async function subscribePush(): Promise<{ ok: true; sub: PushSubscriptionJSON } | { ok: false; why: string }> {
  const sup = pushSupport();
  if (!sup.ok) return { ok: false, why: sup.why! };
  const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (perm !== "granted") return { ok: false, why: "Notifications are blocked — allow them for this site in your browser settings." };
  try {
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID) }));
    const json = sub.toJSON();
    save(DEVICE, "push", json);
    return { ok: true, sub: json };
  } catch {
    return { ok: false, why: "Couldn't set up notifications on this device. Try again, or check your browser settings." };
  }
}

export async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {}
  const old = savedSubscription();
  save(DEVICE, "push", null);
  const s = getSession();
  if (BACKEND && s && old) await fetch(`${API}/v1/push/unsubscribe`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.accessToken}` }, body: JSON.stringify({ endpoint: old.endpoint }) }).catch(() => null);
}

/** Send a test through the real push service, a few seconds from now. */
export async function testPush(discreet: boolean, delay = 6): Promise<{ ok: boolean; why?: string }> {
  const sub = savedSubscription() ?? (await subscribePush().then((r) => (r.ok ? r.sub : null)));
  if (!sub) return { ok: false, why: "Turn notifications on first." };
  try {
    const res = await fetch("/api/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub, discreet, delay }) });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; gone?: boolean; reason?: string };
    if (j.gone) {
      save(DEVICE, "push", null);
      return { ok: false, why: "This device's notification address expired — turn notifications off and on again." };
    }
    return j.ok ? { ok: true } : { ok: false, why: j.reason === "not-configured" ? "The server isn't set up to send notifications yet." : "The push service didn't accept the test. Try again." };
  } catch {
    return { ok: false, why: "Couldn't reach OVEREO's server." };
  }
}

/**
 * Keep the backend's copy of her upcoming reminders in step, so it can
 * send them when OVEREO is closed. Discreet mode sends neutral wording.
 */
export async function syncReminders(reminders: Reminder[], discreet: boolean) {
  const sub = savedSubscription();
  const s = getSession();
  if (!BACKEND || !sub || !s) return false;
  const upcoming = reminders
    .filter((r) => !r.done && new Date(r.due).getTime() > Date.now())
    .slice(0, 50)
    .map((r) => ({ id: r.id, due: r.due, title: discreet ? "OVEREO" : r.title, body: discreet ? "You have a reminder." : "Tap to open OVEREO.", url: "/app" }));
  const res = await fetch(`${API}/v1/push/subscribe`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.accessToken}` }, body: JSON.stringify({ subscription: sub, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, reminders: upcoming }) }).catch(() => null);
  return !!res?.ok;
}
