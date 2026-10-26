import { useMemo } from "react";
import { navigate } from "../core/routes";
import { toast } from "../core/store";
import { agentById, isQuiet, reconcile } from "./agents";
import { learn, type Learned } from "./patterns";
import { addReminder, bumpFeedback, diary, setInbox, space, updateReminder, useSpace } from "./space";
import type { Suggestion } from "./types";

/* ------------------------------------------------------------------ *
 * What happens when she says yes, edits, or says no — and the loop that
 * lets agents look at her data and propose things.
 * ------------------------------------------------------------------ */

/** Everything OVEREO has learned, recomputed only when her data changes. */
export function useLearned(): Learned {
  const records = useSpace((s) => s.records);
  const account = useSpace((s) => s.account);
  const feedback = useSpace((s) => s.feedback);
  const overrides = useSpace((s) => s.overrides);
  const told = useSpace((s) => s.told);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => learn(space.get()), [records, account, feedback, overrides, told]);
}

/** Let every enabled agent look at her data and update the inbox. */
export function runAgents() {
  const s = space.get();
  if (!s.ready) return;
  const next = reconcile(s, learn(s));
  const changed = next.length !== s.inbox.length || next.some((x, i) => x.id !== s.inbox[i]?.id || x.status !== s.inbox[i]?.status);
  if (changed) setInbox(next);
}

export function approve(id: string, edit?: { due?: string; title?: string }) {
  const s = space.get();
  const sg = s.inbox.find((x) => x.id === id);
  if (!sg) return;
  const final: Suggestion = { ...sg, ...(edit ?? {}) };
  const name = agentById(sg.agent).name;
  switch (final.kind) {
    case "reminder": {
      const r = addReminder({ title: final.title.replace(/\?$/, ""), due: final.due ?? new Date().toISOString(), agent: sg.agent });
      diary(sg.agent, "Set a reminder", `${r.title} · ${new Date(r.due).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`, { kind: "reminder", id: r.id });
      toast("Reminder set");
      break;
    }
    case "plan":
      diary(sg.agent, "Added to your plan", final.title);
      toast("Added to your plan");
      break;
    case "summary":
      diary(sg.agent, "Prepared a summary", final.title);
      break;
    case "test":
      diary(sg.agent, "Saved a test suggestion", final.title);
      break;
    case "log":
      diary(sg.agent, "Opened a tracker for you", final.title);
      break;
    default:
      diary(sg.agent, "You read this", final.title);
  }
  setInbox(space.get().inbox.map((x) => (x.id === id ? { ...final, status: "approved" } : x)));
  if (final.href) navigate(final.href);
  void name;
}

export function dismiss(id: string, reason: Suggestion["dismissReason"] = "not-relevant") {
  const s = space.get();
  const sg = s.inbox.find((x) => x.id === id);
  if (!sg) return;
  setInbox(s.inbox.map((x) => (x.id === id ? { ...x, status: reason === "later" ? "snoozed" : "dismissed", dismissReason: reason } : x)));
  if (reason === "not-relevant") bumpFeedback(`${sg.agent}:${sg.kind}`);
  diary(sg.agent, reason === "later" ? "You snoozed a suggestion" : "You dismissed a suggestion", sg.title);
}

/* ---------------------------- notifications ---------------------------- */

/** Fire due reminders as notifications (discreet wording when asked). */
export async function checkDueReminders() {
  const s = space.get();
  const now = Date.now();
  for (const r of s.reminders) {
    if (r.done || r.notified || new Date(r.due).getTime() > now) continue;
    const agent = r.agent === "you" ? null : s.agents[r.agent];
    if (agent && isQuiet(agent)) continue;
    updateReminder(r.id, { notified: true });
    const title = s.prefs.discreet ? "OVEREO" : r.title;
    const body = s.prefs.discreet ? "You have a reminder." : "Tap to open OVEREO.";
    toast(s.prefs.discreet ? "You have a reminder" : r.title);
    if (!s.prefs.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") continue;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body, tag: r.id, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: "/app" } });
      else new Notification(title, { body });
    } catch {}
  }
}

export async function enableNotifications() {
  if (typeof Notification === "undefined") return false;
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  return p === "granted";
}
