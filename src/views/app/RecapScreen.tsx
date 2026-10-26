"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../../ui/Icon";
import { useStore } from "../../core/store";
import { useLearned } from "../../personal/actions";
import { useSpace } from "../../personal/space";
import { PHASE_META } from "../../core/engines/forecast";
import { fmtDate } from "./kit";

/* =====================================================================
   Weekly recap — a two-minute, story-style look at her week, built
   only from her own data. Tap right/left (or use arrows) to move;
   it advances on its own unless she holds.
   ===================================================================== */

interface Slide {
  id: string;
  icon: IconName;
  kicker: string;
  big: ReactNode;
  body: string;
  hue: number;
}

const DUR = 5200;

export function RecapScreen() {
  const l = useLearned();
  const account = useSpace((s) => s.account);
  const diary = useSpace((s) => s.diary);
  const reduce = useStore((s) => s.reducedMotion);
  const w = l.week;
  const actions = diary.filter((d) => d.agent !== "you" && Date.now() - new Date(d.at).getTime() < 7 * 86_400_000);

  const slides = useMemo<Slide[]>(() => {
    const xs: Slide[] = [
      { id: "hello", icon: "sparkle", kicker: `Week of ${fmtDate(new Date(Date.now() - 6 * 86_400_000), { month: "short", day: "numeric" })}`, big: <>Your week, {account?.name ?? "you"}</>, body: `${w.daysLogged} of 7 days logged · ${w.entries} entries. Here's what they add up to.`, hue: 330 },
    ];
    if (l.cycle.day && l.cycle.phase)
      xs.push({ id: "cycle", icon: "cycle", kicker: "Your cycle", big: <>Day {l.cycle.day} · {PHASE_META[l.cycle.phase].label}</>, body: l.cycle.daysUntil != null && l.cycle.daysUntil >= 0 ? `Next period in about ${l.cycle.daysUntil} days (${l.cycle.nextStart ? fmtDate(l.cycle.nextStart, { month: "short", day: "numeric" }) : ""}).` : "Your period may be on its way — log it when it starts.", hue: 340 });
    if (w.moodAvg != null)
      xs.push({ id: "mood", icon: "smile", kicker: "Mood", big: <>{w.moodAvg}/5</>, body: w.moodPrev != null ? (w.moodAvg > w.moodPrev ? `Up from ${w.moodPrev} last week.` : w.moodAvg < w.moodPrev ? `Down from ${w.moodPrev} last week${l.memory.some((m) => m.id === "mood-premenstrual") ? " — this matches your usual pre-period dip." : "."}` : "Same as last week.") : "Your first week of mood check-ins.", hue: 320 });
    if (w.sleepAvg != null)
      xs.push({ id: "sleep", icon: "moon", kicker: "Sleep", big: <>{w.sleepAvg} h</>, body: w.sleepPrev != null ? `Average a night (last week ${w.sleepPrev} h).` : "Average a night.", hue: 300 });
    if (w.symptoms.length)
      xs.push({ id: "sym", icon: "heart", kicker: "Symptoms", big: <>{w.symptoms[0].name}</>, body: `${w.symptoms.map((x) => `${x.name} on ${x.days} day${x.days === 1 ? "" : "s"}`).slice(0, 3).join(" · ")}.`, hue: 345 });
    if (w.bp) xs.push({ id: "bp", icon: "heart", kicker: "Blood pressure", big: <>{w.bp.sys}/{w.bp.dia}</>, body: w.bp.sys >= 130 || w.bp.dia >= 80 ? "A little high this week — worth re-checking, and mentioning at your next visit." : "In a healthy range this week.", hue: 10 });
    const pattern = l.memory.find((m) => m.kind === "learned");
    if (pattern) xs.push({ id: "pattern", icon: "radar", kicker: "A pattern OVEREO knows", big: <>{pattern.area[0].toUpperCase() + pattern.area.slice(1)}</>, body: pattern.text, hue: 328 });
    xs.push({ id: "agents", icon: "bot", kicker: "Your agents", big: <>{actions.length} action{actions.length === 1 ? "" : "s"}</>, body: actions.length ? actions.slice(0, 3).map((a) => a.action + (a.detail ? ` — ${a.detail}` : "")).join(" · ") : "Nothing approved this week. They'll keep watching and ask when it matters.", hue: 310 });
    xs.push({ id: "next", icon: "trend", kicker: "Next week", big: <>One thing to do</>, body: l.progress.next, hue: 25 });
    return xs;
  }, [l, w, account, actions]);

  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold || reduce || i >= slides.length - 1) return;
    const t = setTimeout(() => setI((x) => Math.min(slides.length - 1, x + 1)), DUR);
    return () => clearTimeout(t);
  }, [i, hold, reduce, slides.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [slides.length]);
  const s = slides[Math.min(i, slides.length - 1)];
  const ready = useSpace((x) => x.ready);
  if (!ready) return <section className="recap-page"><div className="recap askel" /></section>;

  return (
    <section className="recap-page">
      <div className="recap" style={{ ["--h" as string]: s.hue }} onPointerDown={() => setHold(true)} onPointerUp={() => setHold(false)} onPointerLeave={() => setHold(false)}>
        <div className="recap-bars" aria-hidden="true">
          {slides.map((x, j) => (
            <span key={x.id} className={j < i ? "done" : j === i ? `run ${hold || reduce ? "hold" : ""}` : ""} style={{ animationDuration: `${DUR}ms` }}>
              <i />
            </span>
          ))}
        </div>
        <div className="recap-top">
          <span className="recap-kicker">
            <Icon name={s.icon} size={15} /> {s.kicker}
          </span>
          <Link href="/app" className="recap-x" aria-label="Close recap">
            <Icon name="close" size={16} />
          </Link>
        </div>
        <div className="recap-slide" key={s.id} aria-live="polite">
          <h2 className="recap-big">{s.big}</h2>
          <p className="recap-body">{s.body}</p>
        </div>
        <button className="recap-nav prev" aria-label="Previous" onClick={() => setI((x) => Math.max(0, x - 1))} />
        <button className="recap-nav next" aria-label="Next" onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))} />
        <div className="recap-foot">
          <span className="faint small">
            {i + 1} / {slides.length} · built only from your own entries
          </span>
          {i === slides.length - 1 && (
            <Link href="/app" className="btn sm">
              Done
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
