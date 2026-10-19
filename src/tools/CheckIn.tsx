"use client";

import { useMemo, useState } from "react";
import { store, useStore, updateProfile, saveToolResult, toast } from "../core/store";
import { useDerived, derive } from "../core/derived";
import { withTodayLog } from "../core/persona";
import { PHASE_META } from "../core/engines/forecast";
import { narrateProfileChange } from "../core/insights";
import { chime } from "../lib/audio";
import { ToolFrame, Field, Segmented, Toggle, Slider, ResultCard } from "./ToolKit";

/* ------------------------------------------------------------------ *
 * Daily check-in — the main way OVEREO collects data. One tap per
 * question; saving rewrites today's entry, and every engine (signals,
 * forecast, Test Navigator) recomputes from it immediately.
 * ------------------------------------------------------------------ */

const FLOW = [
  { id: 0, label: "None" },
  { id: 1, label: "Spotting" },
  { id: 2, label: "Light" },
  { id: 3, label: "Medium" },
  { id: 4, label: "Heavy" },
];
const MOODS = ["Calm", "Good", "Low", "Anxious", "Irritable", "Foggy"];

export function CheckIn({ compact = false }: { compact?: boolean }) {
  const d = useDerived();
  const saved = useStore((s) => s.toolResults.checkin);
  const today = d.profile.logs[d.profile.logs.length - 1];
  const [pain, setPain] = useState(today.pain);
  const [flow, setFlow] = useState(today.flow);
  const [energy, setEnergy] = useState(today.energy);
  const [sleep, setSleep] = useState(today.sleep);
  const [mood, setMood] = useState<string[]>([]);
  const [bowel, setBowel] = useState(today.bowelPain);
  const [sex, setSex] = useState(today.dyspareunia);
  const [acne, setAcne] = useState(today.acne);
  const [bloat, setBloat] = useState(false);
  const [flush, setFlush] = useState(false);
  const [done, setDone] = useState<null | { before: number; after: number; top: string }>(null);
  const phase = PHASE_META[d.today.phase];

  const hint = useMemo(() => {
    if (d.today.phase === "luteal" && d.today.daysUntil <= 5) return "Late luteal: sleep and energy usually dip for her now — that's the pattern, not a failing.";
    if (d.today.phase === "menstrual") return "Period days: pain and flow here are what Silent Signals learns from most.";
    if (d.today.phase === "ovulatory") return "Around ovulation: mild one-sided pain can be normal.";
    if (d.today.phase === "luteal") return "Luteal: progesterone is up, so temperature and resting heart rate run a little higher.";
    return "Follicular: energy is usually highest in this phase.";
  }, [d.today]);

  const save = () => {
    const s = store.get();
    const before = derive(s.profile, s.levers).signals[0];
    updateProfile((p) => withTodayLog(p, { pain, flow, energy, sleep, bowelPain: bowel, dyspareunia: sex, acne, fatigue: Math.round((100 - energy) / 10) }));
    const s2 = store.get();
    const after = derive(s2.profile, s2.levers).signals.find((x) => x.id === before?.id) ?? derive(s2.profile, s2.levers).signals[0];
    saveToolResult({
      tool: "checkin",
      title: "Daily check-in",
      summary: `Day ${d.today.cycleDay}: pain ${pain}/10, ${FLOW[flow].label.toLowerCase()} flow, energy ${energy}, sleep ${sleep} h${mood.length ? `, ${mood.join(", ").toLowerCase()}` : ""}.`,
      level: pain >= 7 || flow >= 4 ? "moderate" : "low",
      facts: { pain, flow, energy, sleep, bloating: bloat, hotFlush: flush, mood: mood.join(",") },
    });
    narrateProfileChange("Check-in saved");
    toast("Check-in saved — signals and forecast updated");
    chime();
    setDone({ before: Math.round((before?.strength ?? 0) * 100), after: Math.round((after?.strength ?? 0) * 100), top: after?.title ?? "" });
  };

  return (
    <ToolFrame icon="calendar" title="Today's check-in" intro={<>Cycle day {d.today.cycleDay} · {phase.label}. {hint}</>}>
      <div className={`tool-grid ${compact ? "compact" : ""}`}>
        <Field label="Pain" hint="0 none · 10 worst imaginable">
          <Slider value={pain} min={0} max={10} onChange={setPain} label="Pain" fmt={(v) => `${v}/10`} />
        </Field>
        <Field label="Flow">
          <Segmented value={flow} options={FLOW} onChange={setFlow} label="Flow" />
        </Field>
        <Field label="Energy">
          <Slider value={energy} min={0} max={100} onChange={setEnergy} label="Energy" />
        </Field>
        <Field label="Sleep last night">
          <Slider value={sleep} min={3} max={11} step={0.5} onChange={setSleep} label="Sleep hours" fmt={(v) => `${v} h`} />
        </Field>
        <Field label="Mood" hint="Pick any">
          <div className="toggle-row">
            {MOODS.map((m) => (
              <Toggle key={m} on={mood.includes(m)} onChange={(on) => setMood((x) => (on ? [...x, m] : x.filter((y) => y !== m)))}>
                {m}
              </Toggle>
            ))}
          </div>
        </Field>
        <Field label="Also today">
          <div className="toggle-row">
            <Toggle on={bowel} onChange={setBowel}>
              Bowel pain
            </Toggle>
            <Toggle on={sex} onChange={setSex}>
              Pain with sex
            </Toggle>
            <Toggle on={acne} onChange={setAcne}>
              Breakouts
            </Toggle>
            <Toggle on={bloat} onChange={setBloat}>
              Bloating
            </Toggle>
            <Toggle on={flush} onChange={setFlush}>
              Hot flush / night sweat
            </Toggle>
          </div>
        </Field>
      </div>
      <div className="tool-foot">
        <button className="btn" onClick={save}>
          Save check-in
        </button>
        <span className="faint small">{saved ? `Last saved ${new Date(saved.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Stored on this device in the prototype."}</span>
      </div>
      {done && (
        <ResultCard
          level={pain >= 7 || flow >= 4 ? "moderate" : "low"}
          title="Saved — everything recalculated"
          summary={done.top ? `${done.top}: consistency ${done.before}% → ${done.after}%. One day rarely moves a pattern much; months of days do.` : "No patterns changed."}
          points={[pain >= 7 ? "Pain of 7 or more is worth noting for your clinician — it's in your dossier now." : "", flow >= 4 ? "Heavy flow today — your iron trend is watched alongside it." : ""].filter(Boolean)}
          next={[
            { label: "See signals", href: "/signals", icon: "radar" },
            { label: "Test Navigator", href: "/tests", icon: "flask" },
          ]}
          ask="What should she focus on today?"
          saved
        />
      )}
    </ToolFrame>
  );
}
