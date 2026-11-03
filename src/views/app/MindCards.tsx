"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../../ui/Icon";
import { openSI } from "../../core/store";
import { useMind } from "../../personal/mind";
import type { Insight } from "../../personal/mind/model";
import { sleepWhatIf } from "../../personal/mind/whatif";
import { sureLabel } from "../../personal/mind/stats";
import { Card } from "./kit";
import { useSpace } from "../../personal/space";

/* =====================================================================
   OVEREO Mind on Today: what matters for her right now, and a what-if
   she can play with — both from her own data, both explain themselves.
   ===================================================================== */

const KIND: Record<Insight["kind"], { icon: IconName; label: string }> = {
  watch: { icon: "alert", label: "Worth a look" },
  "heads-up": { icon: "clock", label: "Coming up" },
  good: { icon: "trend", label: "Good news" },
  info: { icon: "sparkle", label: "About you" },
};

export function ForYouCard() {
  const m = useMind();
  const items = m.insights.slice(0, 3);
  const [open, setOpen] = useState<string | null>(null);
  const discreet = useSpace((s) => s.prefs.discreet);
  const [reveal, setReveal] = useState(!discreet);
  useEffect(() => setReveal(!discreet), [discreet]);
  return (
    <Card className="today-foryou" title="For you today" icon="sparkle" action={<span className="faint small">From your own data</span>}>
      {!reveal ? (
        <button className="chip" onClick={() => setReveal(true)}>
          <Icon name="eyeoff" size={13} /> Tap to show
        </button>
      ) : items.length ? (
        <ul className="fy-list">
          {items.map((i) => (
            <li key={i.id} className={`fy fy-${i.kind}`}>
              <span className="fy-ic" aria-hidden="true">
                <Icon name={KIND[i.kind].icon} size={15} />
              </span>
              <div className="fy-main">
                <span className="fy-kind">{KIND[i.kind].label}</span>
                <b className="fy-title">{i.title}</b>
                <p className="fy-text">{i.text}</p>
                <div className="fy-row">
                  {i.action &&
                    (i.action.href ? (
                      <Link className="chip" href={i.action.href}>
                        {i.action.label} <Icon name="arrow" size={12} />
                      </Link>
                    ) : (
                      <button className="chip" onClick={() => openSI(i.action!.ask ?? i.title)}>
                        <Icon name="sparkle" size={12} /> {i.action.label}
                      </button>
                    ))}
                  <button className="fy-why" aria-expanded={open === i.id} onClick={() => setOpen((o) => (o === i.id ? null : i.id))}>
                    Why this?
                  </button>
                  <span className="faint small">{sureLabel(i.confidence)}</span>
                </div>
                {open === i.id && (
                  <ul className="fy-ev">
                    {i.evidence.map((e, k) => (
                      <li key={k}>
                        <b>{e.label}</b>
                        {e.detail ? ` · ${e.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">Nothing stands out today. As you log, I'll tell you what's unusual for you and what usually comes next — always with the reason.</p>
      )}
    </Card>
  );
}

export function WhatIfCard() {
  const m = useMind();
  const [d, setD] = useState(1);
  const w = useMemo(() => sleepWhatIf(m, d, "mood"), [m, d]);
  const o = w.outcome;
  const pos = (v: number) => (o ? `${((v - o.min) / (o.max - o.min)) * 100}%` : "0%");
  return (
    <Card className="today-whatif" title="What if…" icon="trend" action={<span className="faint small">Your sleep → your mood</span>}>
      {w.ok && o ? (
        <div className="wi">
          <label className="wi-ctl">
            <span>
              Sleep <b>{d > 0 ? "+" : ""}{d} h</b> a night
            </span>
            <input type="range" min={-2} max={2} step={0.5} value={d} onChange={(e) => setD(Number(e.target.value))} aria-label="Change in sleep, hours" />
          </label>
          <div className="mind-outcome-track wi-track" aria-hidden="true">
            <span className="band" style={{ left: pos(o.low), width: `calc(${pos(o.high)} - ${pos(o.low)})` }} />
            <span className="now" style={{ left: pos(o.now) }} />
            <span className="then" style={{ left: pos(o.then) }} />
          </div>
          <p className="wi-text" aria-live="polite">
            {w.text}
          </p>
          <p className="faint small">
            {sureLabel(w.confidence)} · {w.points[0]} Not proof of cause.
          </p>
        </div>
      ) : (
        <p className="small muted">{w.text}</p>
      )}
    </Card>
  );
}
