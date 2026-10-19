import { store } from "../core/store";
import { derive } from "../core/derived";
import { labelFor } from "../core/bus";
import { localAnswer } from "./engine";
import type { SIAnswer, SIContext, SIMessage } from "./types";

/* ------------------------------------------------------------------ *
 * Provider — local by default. Set NEXT_PUBLIC_SI_ENDPOINT to stream from a
 * live model (see server/si-proxy.mjs). Commands, safety rules and UI
 * actions always run locally so SI can still drive the page.
 * ------------------------------------------------------------------ */

// Next.js inlines NEXT_PUBLIC_* variables at build time.
const ENDPOINT = process.env.NEXT_PUBLIC_SI_ENDPOINT;

export const siMode = ENDPOINT ? "live" : "local";

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
    if (!res.ok || !res.body) throw new Error(`SI endpoint ${res.status}`);
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
        used: [...new Set(["Live model", ...local.used])],
        missing: undefined,
      },
    };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { answer: { ...local, limits: [local.limits, "Live model unavailable — answered locally."].filter(Boolean).join(" ") }, remote: false };
  }
}
