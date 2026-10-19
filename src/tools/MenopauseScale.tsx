"use client";

import { useState } from "react";
import { useStore, saveToolResult } from "../core/store";
import { ToolFrame, ResultCard } from "./ToolKit";

/* ------------------------------------------------------------------ *
 * Menopause Rating Scale (MRS) — a validated 11-item questionnaire
 * (Heinemann et al.). Each item 0–4; three subscales; total severity
 * bands 0–4 none/little, 5–8 mild, 9–16 moderate, 17+ severe.
 * Repeat it to see how symptoms — or treatment — change over time.
 * ------------------------------------------------------------------ */

const ITEMS: { id: string; label: string; hint: string; sub: "somatic" | "psych" | "uro" }[] = [
  { id: "hot", label: "Hot flushes, sweating", hint: "Episodes of sweating", sub: "somatic" },
  { id: "heart", label: "Heart discomfort", hint: "Unusual awareness of heartbeat, skipping, racing, tightness", sub: "somatic" },
  { id: "sleep", label: "Sleep problems", hint: "Falling asleep, sleeping through, waking early", sub: "somatic" },
  { id: "mood", label: "Depressive mood", hint: "Feeling down, sad, on the verge of tears, lack of drive", sub: "psych" },
  { id: "irritable", label: "Irritability", hint: "Feeling nervous, inner tension, aggressive", sub: "psych" },
  { id: "anxiety", label: "Anxiety", hint: "Inner restlessness, feeling panicky", sub: "psych" },
  { id: "exhaust", label: "Physical and mental exhaustion", hint: "Lower performance, poor memory and concentration", sub: "psych" },
  { id: "sexual", label: "Sexual problems", hint: "Change in desire, activity and satisfaction", sub: "uro" },
  { id: "bladder", label: "Bladder problems", hint: "Difficulty urinating, urgency, leaking", sub: "uro" },
  { id: "dry", label: "Dryness of vagina", hint: "Dryness or burning, difficulty with intercourse", sub: "uro" },
  { id: "joint", label: "Joint and muscular discomfort", hint: "Pain in the joints, rheumatoid-like complaints", sub: "somatic" },
];
const SCALE = ["None", "Mild", "Moderate", "Severe", "Very severe"];
const SUBS = [
  { id: "somatic", label: "Physical", max: 16 },
  { id: "psych", label: "Mood & mind", max: 16 },
  { id: "uro", label: "Urogenital", max: 12 },
] as const;

const band = (t: number) => (t <= 4 ? "none" : t <= 8 ? "low" : t <= 16 ? "moderate" : "high");
const bandLabel = (t: number) => (t <= 4 ? "None or little" : t <= 8 ? "Mild" : t <= 16 ? "Moderate" : "Severe");

export function MenopauseScale() {
  const prev = useStore((s) => s.toolResults.mrs);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [shown, setShown] = useState(false);
  const answered = Object.keys(ans).length;
  const total = Object.values(ans).reduce((a, b) => a + b, 0);
  const sub = (id: string) => ITEMS.filter((i) => i.sub === id).reduce((a, i) => a + (ans[i.id] ?? 0), 0);

  const finish = () => {
    setShown(true);
    saveToolResult({
      tool: "mrs",
      title: "Menopause Rating Scale",
      summary: `Total ${total}/44 — ${bandLabel(total).toLowerCase()} (physical ${sub("somatic")}, mood ${sub("psych")}, urogenital ${sub("uro")}).`,
      level: band(total) as "none" | "low" | "moderate" | "high",
      facts: { total, somatic: sub("somatic"), psych: sub("psych"), uro: sub("uro"), previous: typeof prev?.facts.total === "number" ? prev.facts.total : -1 },
    });
  };

  const prevTotal = typeof prev?.facts.total === "number" ? prev.facts.total : null;
  return (
    <ToolFrame
      icon="trend"
      title="Menopause Rating Scale"
      intro="Eleven questions about how you've felt recently. Validated, quick, and worth repeating every few months — or after starting treatment."
      source={{ label: "Heinemann et al., Health Qual Life Outcomes (2004)", url: "https://hqlo.biomedcentral.com/articles/10.1186/1477-7525-2-45" }}
    >
      <ol className="mrs-list">
        {ITEMS.map((it, i) => (
          <li key={it.id} className="mrs-item">
            <div>
              <b className="small">
                {i + 1}. {it.label}
              </b>
              <span className="faint small">{it.hint}</span>
            </div>
            <div className="mrs-scale" role="radiogroup" aria-label={it.label}>
              {SCALE.map((s, v) => (
                <button key={s} role="radio" aria-checked={ans[it.id] === v} className={`mrs-dot ${ans[it.id] === v ? "on" : ""}`} style={{ ["--v" as string]: v }} onClick={() => setAns((a) => ({ ...a, [it.id]: v }))} title={s}>
                  <span className="sr-only">{s}</span>
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="mrs-legend faint small">
        {SCALE.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="mrs-bars" aria-hidden={!answered}>
        {SUBS.map((s) => (
          <div key={s.id} className="mrs-bar">
            <span className="small">{s.label}</span>
            <span className="mrs-track">
              <span className="mrs-fill" style={{ transform: `scaleX(${sub(s.id) / s.max})` }} />
            </span>
            <b className="tnum small">
              {sub(s.id)}/{s.max}
            </b>
          </div>
        ))}
      </div>
      <div className="tool-foot">
        <button className="btn" onClick={finish} disabled={answered < ITEMS.length}>
          {answered < ITEMS.length ? `${ITEMS.length - answered} to go` : "See my score"}
        </button>
        {prev && !shown && <span className="faint small">Last time: {prev.summary}</span>}
      </div>
      {shown && (
        <ResultCard
          level={band(total) as "none" | "low" | "moderate" | "high"}
          title={`${total}/44 · ${bandLabel(total)}`}
          summary={
            total > 8
              ? "Symptoms at this level are affecting your quality of life — and they're treatable. Options include menopausal hormone therapy, newer non-hormonal medicines, CBT and targeted sleep support."
              : "Few symptoms right now. Keeping this as a baseline means changes later are easy to see."
          }
          points={[
            prevTotal != null && prevTotal >= 0 ? `Change since last time: ${total - prevTotal > 0 ? "+" : ""}${total - prevTotal}` : "",
            sub("uro") >= 4 ? "Urogenital symptoms respond well to local treatment — they don't usually improve on their own." : "",
            sub("psych") >= 6 ? "Mood symptoms are part of the transition for many women; BioMynd can help alongside medical care." : "",
          ].filter(Boolean)}
          next={[
            { label: "Menopause care", href: "/specialties/menopause", icon: "trend" },
            { label: "Menopause plan", href: "/future?tab=menopause", icon: "calendar" },
          ]}
          ask="Is hormone therapy safe?"
          saved
        />
      )}
    </ToolFrame>
  );
}
