"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore, openSI, type Insight } from "../core/store";
import { useDerived } from "../core/derived";
import { run } from "../core/bus";
import { metricSeries, PHASE_META } from "../core/engines/forecast";
import { levelLabel } from "../core/engines/signals";
import { recommend } from "../core/engines/recommend";
import { fmtDate, addDays } from "../core/rng";
import { PageHero, SectionTitle, EmptyState, AskChips } from "../ui/Page";
import { CircularProgress, AnimatedList } from "../ui/Motion";
import { Icon } from "../ui/Icon";
import { CheckIn } from "../tools/CheckIn";
import { TabbedPage, Panel } from "./TabbedPage";

/* =====================================================================
   /today — the daily home of the app: where she is in her cycle, what
   the next week probably holds, the one or two things worth doing, and
   Overeo SI's live narration of everything that changed.
   ===================================================================== */

export function TodayView({ initialTab }: { initialTab?: string }) {
  const d = useDerived();
  const ph = PHASE_META[d.today.phase];
  return (
    <TabbedPage
      routeId="today"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow={`Today · ${d.profile.name} · sample data`}
          title={
            <>
              Day {d.today.cycleDay}. <span className="serif grad-text">{ph.label}.</span>
            </>
          }
          lede={`${ph.desc} Next period in about ${d.today.daysUntil} days — ${fmtDate(d.today.nextStart)}, ±${Math.max(1, Math.round(d.today.sdLength))}.`}
        />
      }
      narration={{
        checkin: "Thirty seconds. It rewrites today's entry and every chart follows.",
        plan: "Everything queued for her — agent steps, visits and test windows — in one list.",
      }}
      panels={{
        overview: () => <Overview />,
        checkin: () => (
          <Panel>
            <CheckIn />
          </Panel>
        ),
        insights: () => <InsightsPanel />,
        plan: () => <PlanPanel />,
      }}
    />
  );
}

function Overview() {
  const d = useDerived();
  const nav = useStore((s) => s.nav);
  const tools = useStore((s) => s.toolResults);
  const res = useMemo(() => recommend(d, nav, tools), [d, nav, tools]);
  const week = useMemo(() => {
    const e = metricSeries(d.profile, "energy", 0, 7).filter((p) => p.predicted);
    const s = metricSeries(d.profile, "sleep", 0, 7).filter((p) => p.predicted);
    return e.map((p, i) => ({ date: p.date, phase: p.phase, energy: p.v, elo: p.lo!, ehi: p.hi!, sleep: s[i].v }));
  }, [d.profile]);
  const steps = [
    ...res.recs.filter((r) => r.tier === "discuss").slice(0, 2).map((r) => ({ id: r.test.id, icon: "flask" as const, text: `Discuss ${r.test.name.split(" (")[0].split(":")[0]}`, sub: r.reasons[0]?.text, href: "/tests" })),
    ...(!tools.checkin ? [{ id: "ci", icon: "calendar" as const, text: "Log today's check-in", sub: "30 seconds — it sharpens every forecast.", href: "/today?tab=checkin" }] : []),
    ...(!tools.pain && d.signals.some((s) => s.id === "endo") ? [{ id: "pm", icon: "target" as const, text: "Map her period pain", sub: "Turns the pattern into guideline features.", href: "/tools?tab=pain" }] : []),
  ].slice(0, 4);
  const maxE = Math.max(...week.map((w) => w.ehi), 100);
  return (
    <Panel className="today-grid">
      <div className="glass holo today-ring">
        <CircularProgress value={d.today.cycleDay} max={d.today.meanLength} size={168} stroke={12} gradientId="today-cp">
          <div className="tnum" style={{ fontSize: 40, fontWeight: 650, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {d.today.cycleDay}
          </div>
          <div className="faint small">of ~{Math.round(d.today.meanLength)} days</div>
        </CircularProgress>
        <div className="today-kv">
          <Fact k="Phase" v={PHASE_META[d.today.phase].label} />
          <Fact k="Next period" v={`${fmtDate(d.today.nextStart)} · ±${Math.max(1, Math.round(d.today.sdLength))} d`} />
          <Fact k="Forecast confidence" v={`${Math.round(d.today.confidence * 100)}%`} />
          <Fact k="Ovarian Clock" v={`${d.clock.markerAge} (age ${d.clock.calendarAge})`} />
        </div>
      </div>

      <div className="glass today-week">
        <div className="card-head">
          <b>Next 7 days</b>
          <span className="faint small">Predicted from her own cycles · shaded = range</span>
        </div>
        <div className="week-bars" role="img" aria-label="Predicted energy for the next seven days">
          {week.map((w, i) => (
            <div key={i} className="wk" style={{ ["--pc" as string]: PHASE_META[w.phase].color, ["--i" as string]: i }} title={`${PHASE_META[w.phase].label} · energy ~${Math.round(w.energy)} (${Math.round(w.elo)}–${Math.round(w.ehi)})`}>
              <span className="wk-plot">
                <span className="wk-cone" style={{ bottom: `${(Math.max(0, w.elo) / maxE) * 100}%`, height: `${((w.ehi - Math.max(0, w.elo)) / maxE) * 100}%` }} />
                <span className="wk-bar" style={{ height: `${(w.energy / maxE) * 100}%` }} />
              </span>
              <span className="wk-l faint small">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][w.date.getDay()]}</span>
              <span className="wk-s faint tnum">{w.sleep.toFixed(1)}h</span>
            </div>
          ))}
        </div>
        <p className="small muted">
          {week.some((w) => w.phase === "menstrual") ? `Her period is likely to start around ${fmtDate(d.today.nextStart)}; energy usually dips on days 1–2.` : "A steady week."} Predicted sleep shown under each day.
        </p>
      </div>

      <div className="glass today-steps">
        <div className="card-head">
          <b>Next best steps</b>
          <span className="faint small">Ranked by SI</span>
        </div>
        {steps.length ? (
          <ul className="step-list">
            {steps.map((s) => (
              <li key={s.id}>
                <Link href={s.href}>
                  <span className="feat-ic sm">
                    <Icon name={s.icon} size={15} />
                  </span>
                  <span>
                    <b className="small">{s.text}</b>
                    {s.sub && <span className="faint small">{s.sub}</span>}
                  </span>
                  <Icon name="chevron" size={15} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="check" title="All caught up" text="Nothing needs her attention today." />
        )}
      </div>

      <div className="glass today-signals">
        <div className="card-head">
          <b>Silent Signals</b>
          <Link className="small" href="/signals">
            Open <Icon name="arrow" size={12} />
          </Link>
        </div>
        <ul className="sig-mini">
          {d.signals.slice(0, 4).map((s) => (
            <li key={s.id}>
              <span className={`sig-dot ${s.level}`} />
              <span className="small">
                <b>{s.title}</b> <span className="faint">· {levelLabel[s.level]}</span>
              </span>
              <span className="sig-bar">
                <span style={{ transform: `scaleX(${s.strength})` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <LiveInsights />
    </Panel>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span className="faint small">{k}</span>
      <b className="tnum small">{v}</b>
    </div>
  );
}

function LiveInsights({ max = 5 }: { max?: number }) {
  const insights = useStore((s) => s.insights);
  return (
    <div className="glass today-live">
      <div className="card-head">
        <b>
          <span className="live-dot" /> Overeo SI · live
        </b>
        <span className="faint small">Narrates what changes</span>
      </div>
      {insights.length ? (
        <AnimatedList
          items={insights}
          max={max}
          render={(it: Insight) => (
            <button className="live-item" onClick={() => openSI(`Tell me more about ${it.tag}: ${it.text}`)}>
              <span className={`badge ${it.tone === "alert" ? "alert" : it.tone === "good" ? "good" : it.tone === "signal" ? "signal" : ""}`}>{it.tag}</span>
              <span className="small">{it.text}</span>
            </button>
          )}
        />
      ) : (
        <div className="skeleton" style={{ height: 120 }} />
      )}
    </div>
  );
}

function InsightsPanel() {
  return (
    <Panel className="insights-panel">
      <SectionTitle kicker="Live" title="Everything SI has noticed this session">
        Tap any insight and SI explains it — with what it used and what it didn't have.
      </SectionTitle>
      <LiveInsights max={24} />
      <AskChips items={[{ label: "What should she focus on today?", ask: "What should she focus on today?" }, { label: "Why is she so tired?", ask: "Why is she so tired?" }, { label: "Which tests should she take?", ask: "Which tests should she take?" }, { label: "When is her next period?", ask: "When is her next period?" }]} />
    </Panel>
  );
}

function PlanPanel() {
  const d = useDerived();
  const tasks = useStore((s) => s.agentTasks);
  const visits = useStore((s) => s.visits);
  const nav = useStore((s) => s.nav);
  const tools = useStore((s) => s.toolResults);
  const res = useMemo(() => recommend(d, nav, tools), [d, nav, tools]);
  const windows = res.recs.filter((r) => (r.tier === "discuss" || r.tier === "consider") && r.timing.window);
  const items = [
    ...windows.map((r) => ({ id: `t-${r.test.id}`, at: r.timing.window![0], icon: "flask" as const, title: r.test.name, sub: r.timing.label })),
    ...tasks.map((t) => ({ id: t.id, at: addDays(d.profile.today, 1), icon: "bolt" as const, title: t.title, sub: `${t.owner} · ${t.status}` })),
    ...visits.map((v) => ({ id: v.id, at: new Date(v.at), icon: "users" as const, title: `Visit request · ${v.specialty}`, sub: v.kind })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return (
    <Panel>
      <SectionTitle kicker="Plan" title="What's coming up" />
      {items.length ? (
        <ol className="plan-list">
          {items.map((it, i) => (
            <li key={it.id} className="glass" style={{ ["--i" as string]: i }}>
              <span className="timing-date tnum">{fmtDate(it.at)}</span>
              <Icon name={it.icon} size={16} />
              <span>
                <b className="small">{it.title}</b>
                <span className="faint small">{it.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState icon="calendar" title="Nothing planned yet" text="Ask the agent to draft a plan from her signals — every step waits for your approval." action={{ label: "Draft a plan", onClick: () => run({ type: "goto", section: "agent" }) }} />
      )}
      <div className="row-actions">
        <button className="btn ghost" onClick={() => {
          run({ type: "goto", section: "agent" });
          run({ type: "run-agent" });
        }}>
          <Icon name="bolt" size={16} /> Ask the agent to plan
        </button>
      </div>
    </Panel>
  );
}
