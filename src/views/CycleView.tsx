"use client";

import { useMemo } from "react";
import { useDerived } from "../core/derived";
import { PHASE_META } from "../core/engines/forecast";
import { fmtDate } from "../core/rng";
import { mean } from "../core/rng";
import type { Phase } from "../core/persona";
import { PageHero, SectionTitle, StatTiles, AskChips, Disclaimer } from "../ui/Page";
import { CycleCalendar } from "../ui/CycleCalendar";
import { Lens } from "../sections/Lens";
import { TabbedPage, Panel } from "./TabbedPage";

/* /cycle — the Cycle Lens, a predictive calendar, cycle-by-cycle
   patterns, and what each phase actually does. */

export function CycleView({ initialTab }: { initialTab?: string }) {
  const d = useDerived();
  return (
    <TabbedPage
      routeId="lens"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Cycle"
          title={
            <>
              Her cycle, <span className="serif grad-text">learned</span> — not assumed to be 28 days.
            </>
          }
          lede={`Average ${d.today.meanLength} days (±${d.today.sdLength}) across her last six cycles. Temperature, heart rate, sleep and energy all follow it — so the forecast does too.`}
        />
      }
      narration={{
        forecast: "The calendar widens around predicted periods — that's honest uncertainty, not a bug.",
        patterns: "Cycle by cycle, you can see which months were heavy and painful.",
      }}
      panels={{
        lens: () => <Lens />,
        forecast: () => <Forecast />,
        patterns: () => <Patterns />,
        learn: () => <Phases />,
      }}
    />
  );
}

function Forecast() {
  const d = useDerived();
  return (
    <Panel className="timing">
      <SectionTitle kicker="Next six weeks" title="Predicted from her own cycles">
        Next period around {fmtDate(d.today.nextStart)}, fertile window shaded, prediction range outlined.
      </SectionTitle>
      <div className="timing-grid">
        <CycleCalendar d={d} days={42} />
        <StatTiles
          items={[
            { label: "Average cycle (days)", value: d.today.meanLength, decimals: 1 },
            { label: "Variation (± days)", value: d.today.sdLength, decimals: 1 },
            { label: "Forecast confidence", value: Math.round(d.today.confidence * 100), suffix: "%" },
            { label: "Days to next period", value: d.today.daysUntil },
          ]}
        />
      </div>
      <AskChips items={[{ label: "When is her next period?", ask: "When is her next period?" }, { label: "Why does it vary?", ask: "Why are her cycles irregular?" }, { label: "Which phase is she in?", ask: "Which phase is she in?" }]} />
    </Panel>
  );
}

function Patterns() {
  const d = useDerived();
  const rows = useMemo(() => {
    return d.profile.cycles
      .map((c, i) => {
        const logs = d.profile.logs.filter((l) => l.cycleIndex === i);
        if (!logs.length) return null;
        const len = c.length ?? logs.length;
        const late = logs.filter((l) => l.cycleDay > len - 5);
        return {
          i,
          start: c.start,
          length: c.length,
          heavy: logs.filter((l) => l.flow >= 3).length,
          pain: Math.max(...logs.map((l) => l.pain)),
          bowel: logs.some((l) => l.bowelPain),
          sleepLate: late.length ? mean(late.map((l) => l.sleep)) : null,
          energy: mean(logs.map((l) => l.energy)),
        };
      })
      .filter(Boolean)
      .reverse() as { i: number; start: Date; length: number | null; heavy: number; pain: number; bowel: boolean; sleepLate: number | null; energy: number }[];
  }, [d.profile]);
  return (
    <Panel>
      <SectionTitle kicker="Patterns" title="Cycle by cycle">
        Each row is one cycle. Silent Signals looks for what repeats across rows.
      </SectionTitle>
      <div className="marker-table glass cycles" role="table" aria-label="Cycles">
        <div className="mt-row head small faint" role="row">
          <span role="columnheader">Started</span>
          <span role="columnheader">Length</span>
          <span role="columnheader">Heavy days</span>
          <span role="columnheader">Peak pain</span>
          <span role="columnheader">Bowel pain</span>
          <span role="columnheader">Late-luteal sleep</span>
        </div>
        {rows.map((r) => (
          <div key={r.i} className="mt-row" role="row">
            <span role="cell" className="small">
              <b>{fmtDate(r.start)}</b>
            </span>
            <span role="cell" className={`tnum ${r.length && (r.length > 35 || r.length < 21) ? "flag" : ""}`}>
              {r.length ? `${r.length} d` : "current"}
            </span>
            <span role="cell" className={`tnum ${r.heavy >= 3 ? "flag" : ""}`}>
              {r.heavy}
            </span>
            <span role="cell" className="tnum">
              <span className="pain-pill" style={{ ["--a" as string]: r.pain / 10 }}>
                {r.pain}/10
              </span>
            </span>
            <span role="cell" className="small">
              {r.bowel ? "Yes" : "—"}
            </span>
            <span role="cell" className="tnum small">
              {r.sleepLate != null ? `${r.sleepLate.toFixed(1)} h` : "—"}
            </span>
          </div>
        ))}
      </div>
      <Disclaimer />
    </Panel>
  );
}

const PHASE_MORE: Record<Phase, { days: string; body: string; tip: string }> = {
  menstrual: { days: "Days 1–5", body: "The uterine lining sheds. Prostaglandins drive cramps and can loosen bowels.", tip: "Iron-rich food; heat and NSAIDs for cramps; log pain and flow — this is where patterns live." },
  follicular: { days: "Days 6–~13", body: "Estrogen rises as a follicle matures. Energy, mood and recovery are often best.", tip: "A good window for harder training and demanding work." },
  ovulatory: { days: "~3 days mid-cycle", body: "An LH surge releases the egg. Some women feel one-sided twinges (mittelschmerz).", tip: "The most fertile days are the five before ovulation and the day of it." },
  luteal: { days: "~14 days before the next period", body: "Progesterone raises temperature (~0.3 °C) and resting heart rate. Late in the phase, both hormones fall.", tip: "Earlier wind-down: sleep often dips in the last five days." },
};

function Phases() {
  return (
    <Panel>
      <SectionTitle kicker="Learn" title="What each phase does" />
      <div className="phase-cards">
        {(Object.keys(PHASE_META) as Phase[]).map((p, i) => (
          <div key={p} className="glass phase-card" style={{ ["--pc" as string]: PHASE_META[p].color, ["--i" as string]: i }}>
            <span className="phase-chip" />
            <b className="title-sm">{PHASE_META[p].label}</b>
            <span className="faint small">{PHASE_MORE[p].days}</span>
            <p className="small">{PHASE_MORE[p].body}</p>
            <p className="small muted">{PHASE_MORE[p].tip}</p>
          </div>
        ))}
      </div>
      <AskChips items={[{ label: "Why does sleep drop before her period?", ask: "Why does sleep drop before her period?" }, { label: "What does skin temperature show?", ask: "What does skin temperature show?" }, { label: "Is period pain normal?", ask: "Is period pain normal?" }]} />
    </Panel>
  );
}
