import { store } from "../core/store";
import { derive } from "../core/derived";
import { labelFor } from "../core/bus";
import { localAnswer } from "./engine";
import type { SIAnswer, SIContext, SIMessage } from "./types";
import { space } from "../personal/space";
import { learn, siContext } from "../personal/patterns";

/* ------------------------------------------------------------------ *
 * Provider — Overeo SI's live brain is Xevyo, reached through our own
 * server route (/api/si) so the key never reaches the browser. Commands,
 * safety rules and UI actions always run locally, and if Xevyo is
 * unavailable (offline, quota, not configured) SI answers on-device.
 * Set NEXT_PUBLIC_SI_LIVE=0 to stay fully on-device.
 * ------------------------------------------------------------------ */

// Next.js inlines NEXT_PUBLIC_* variables at build time.
const ENDPOINT = process.env.NEXT_PUBLIC_SI_LIVE === "0" ? undefined : process.env.NEXT_PUBLIC_SI_ENDPOINT || "/api/si";

export const siMode = ENDPOINT ? "live" : "local";

/** After a failure, don't retry the live brain for a little while. */
const COOL_KEY = "overeo.si.cool";
const cooling = () => {
  try {
    return Number(sessionStorage.getItem(COOL_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
};
const coolDown = (ms: number) => {
  try {
    sessionStorage.setItem(COOL_KEY, String(Date.now() + ms));
  } catch {}
};
const REASON: Record<string, string> = {
  quota: "Overeo SI's live brain has reached its usage limit for now",
  "not-configured": "Overeo SI's live brain isn't connected on this server",
  auth: "Overeo SI's live brain refused the key",
  "rate-limited": "Overeo SI is busy",
  unreachable: "Overeo SI's live brain can't be reached",
  upstream: "Overeo SI's live brain had a problem",
  offline: "You're offline",
};

/** Compact, de-identified context sent to the live model. */
export function contextPayload(ctx: SIContext) {
  const s = store.get();
  const d = derive(s.profile, s.levers);
  return {
    section: labelFor(ctx.section),
    profile: ctx.useProfile
      ? {
          sample: s.profile.isSample,
          age: s.profile.age,
          cycleDay: d.today.cycleDay,
          phase: d.today.phase,
          meanCycle: d.today.meanLength,
          ovarianClock: { markerAge: d.clock.markerAge, calendarAge: d.clock.calendarAge, band: d.clock.band },
          labs: s.profile.labs.map((l) => ({ name: l.name, unit: l.unit, latest: l.points[l.points.length - 1].value })),
        }
      : null,
    signals: ctx.useSignals ? d.signals.map((x) => ({ title: x.title, level: x.level, strength: x.strength, evidence: x.evidence })) : null,
    // what OVEREO has learned about HER (her own space, or Maya's sample)
    personal: (() => {
      const sp = space.get();
      if (!sp.ready) return null;
      const base = siContext(sp, learn(sp));
      return ctx.useProfile && sp.account?.consent.personalise !== false ? base : { language: base.language };
    })(),
  };
}

/**
 * Answer a question. `onText` receives streamed text (live mode). Returns
 * the structured answer; in live mode the model's text becomes `summary`
 * while local intents still contribute actions and effects.
 */
export async function ask(
  q: string,
  ctx: SIContext,
  history: SIMessage[],
  onText: (t: string) => void,
  signal?: AbortSignal,
): Promise<{ answer: SIAnswer; remote: boolean }> {
  const local = localAnswer(q, ctx);
  const isCommand = !!local.effects?.length;
  if (!ENDPOINT || isCommand || local.tone === "alert") return { answer: local, remote: false };
  const fallback = (reason: string) => ({
    answer: { ...local, limits: [local.limits, `${REASON[reason] ?? REASON.upstream} — answered on this device.`].filter(Boolean).join(" ") },
    remote: false,
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) return fallback("offline");
  if (cooling()) return fallback("upstream");

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          ...history.slice(-8).map((m) => ({ role: m.role === "si" ? "assistant" : "user", content: m.role === "si" ? (m.answer?.summary ?? m.text) : m.text })),
          { role: "user", content: q },
        ],
        context: contextPayload(ctx),
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      const info = (await res.json().catch(() => ({}))) as { reason?: string };
      coolDown(info.reason === "quota" ? 10 * 60_000 : 2 * 60_000);
      return fallback(info.reason ?? "upstream");
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      onText(text);
    }
    return {
      remote: true,
      answer: {
        ...local,
        title: local.title.startsWith("Let me point") ? "Overeo SI" : local.title,
        summary: text.trim(),
        points: undefined,
        used: [...new Set(["Overeo SI · Xevyo", ...local.used])],
        missing: undefined,
      },
    };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    coolDown(2 * 60_000);
    return fallback("unreachable");
  }
}
