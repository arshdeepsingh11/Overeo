"use client";

import Link from "next/link";
import { useDerived } from "../core/derived";
import { openSI } from "../core/store";
import { medianAmh } from "../core/engines/clock";
import { OVARY_FACT } from "../core/research";
import { fmtFull } from "../core/rng";
import type { Lab } from "../core/persona";
import { specialtyBySlug } from "../content/specialties";
import { PageHero, SectionTitle, Callout, PathSteps, Sources, Disclaimer, AskChips } from "../ui/Page";
import { Icon } from "../ui/Icon";
import { Clock } from "../sections/Clock";
import { TabbedPage, Panel } from "./TabbedPage";

/* /clock — the Ovarian Clock, her markers over time, a fertility
   planning guide with real numbers, and the science behind it. */

export function ClockView({ initialTab }: { initialTab?: string }) {
  const d = useDerived();
  return (
    <TabbedPage
      routeId="clock"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Ovarian Clock"
          title={
            <>
              Reproductive markers of <span className="serif grad-text">{d.clock.markerAge}</span> at {d.clock.calendarAge}.
            </>
          }
          lede="Not a fertility verdict — a timeline. It shows where her markers sit for her age, what moves them, and what that means for decisions like egg freezing."
        />
      }
      narration={{
        markers: "Each marker is shown with the cycle day it was drawn on — FSH and estradiol mean nothing without it.",
        planning: "Real numbers, not fear: age at freezing matters more than anything else.",
      }}
      panels={{
        clock: () => <Clock />,
        markers: () => <Markers />,
        planning: () => <Planning />,
        learn: () => <Learn />,
      }}
    />
  );
}

function Spark({ lab }: { lab: Lab }) {
  const pts = lab.points;
  if (pts.length < 2) return <span className="faint small">Single result</span>;
  const vs = pts.map((p) => p.value);
  const lo = Math.min(lab.range[0], ...vs);
  const hi = Math.max(lab.range[1] * 0.6, ...vs);
  const W = 120;
  const H = 34;
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (W - 8);
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);
  const dPath = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const yLow = y(lab.range[0]);
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1="0" x2={W} y1={yLow} y2={yLow} className="spark-range" />
      <path d={dPath} className="spark-line" />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === pts.length - 1 ? 3 : 2} className="spark-dot" />
      ))}
    </svg>
  );
}

function Markers() {
  const d = useDerived();
  return (
    <Panel>
      <SectionTitle kicker="Markers" title="Every result, on one timeline">
        Same lab, same assay where possible — so a change is biology, not lab-to-lab noise.
      </SectionTitle>
      <div className="marker-table glass" role="table" aria-label="Lab markers">
        <div className="mt-row head small faint" role="row">
          <span role="columnheader">Marker</span>
          <span role="columnheader">Latest</span>
          <span role="columnheader">Range</span>
          <span role="columnheader">Trend</span>
          <span role="columnheader">Context</span>
        </div>
        {d.profile.labs.map((l) => {
          const last = l.points[l.points.length - 1];
          const low = last.value < l.range[0];
          const high = last.value > l.range[1];
          return (
            <div key={l.key} className="mt-row" role="row">
              <span role="cell">
                <b className="small">{l.name}</b>
                <span className="faint small">{fmtFull(last.date)}</span>
              </span>
              <span role="cell" className={`tnum ${low || high ? "flag" : ""}`}>
                {last.value} <span className="faint small">{l.unit}</span>
                {(low || high) && <span className="badge signal">{low ? "low" : "high"}</span>}
              </span>
              <span role="cell" className="faint small tnum">
                {l.range[0]}–{l.range[1]}
              </span>
              <span role="cell">
                <Spark lab={l} />
              </span>
              <span role="cell" className="small muted">
                {l.phaseNote ?? l.source}
              </span>
            </div>
          );
        })}
      </div>
      <div className="row-actions">
        <Link className="btn ghost" href="/tests">
          <Icon name="flask" size={16} /> What to test next
        </Link>
        <button className="btn ghost" onClick={() => openSI("What does AMH 1.3 mean?")}>
          <Icon name="sparkle" size={16} /> Explain her AMH
        </button>
      </div>
    </Panel>
  );
}

function Planning() {
  const d = useDerived();
  const amh = d.profile.markers.amh;
  const med = medianAmh(d.profile.age);
  const sp = specialtyBySlug("fertility")!;
  return (
    <Panel className="planning">
      <SectionTitle kicker="Fertility planning" title="Egg freezing, with real numbers" />
      <div className="plan-cards">
        <div className="glass plan-card">
          <span className="faint small upper">Her AMH</span>
          <b className="title-md tnum">{amh} ng/mL</b>
          <span className="small muted">
            Typical for {d.profile.age}: about {med.toFixed(1)} · {amh < med ? "below" : "at or above"} median ({d.clock.percentile}th percentile, rough)
          </span>
          <p className="small">AMH predicts how many eggs a stimulated cycle may yield. It doesn't predict whether she can conceive naturally next month.</p>
        </div>
        <div className="glass plan-card">
          <span className="faint small upper">Age at freezing</span>
          <b className="title-md">The strongest factor</b>
          <p className="small">
            In a widely used model built on clinic data (Goldman et al., 2017), 10 mature eggs frozen at 35 gave about a 69% chance of at least one live birth — about 50% at 37 and 39% at 39. The younger the eggs, the fewer are needed.
          </p>
        </div>
        <div className="glass plan-card">
          <span className="faint small upper">What one cycle looks like</span>
          <b className="title-md">10–14 days</b>
          <p className="small">Daily hormone injections, 4–6 monitoring visits with ultrasound and bloods, then a short sedated retrieval at a partner fertility clinic.</p>
        </div>
      </div>
      <Callout tone="info" title="What SI won't do">
        Tell her she's "running out of time". The clock shows timing and options; the decision is hers, with a clinician who knows her goals.
      </Callout>
      <SectionTitle kicker="Steps" title="How OVEREO walks it with her" />
      <PathSteps
        steps={[
          { title: "Clarify", text: "When might she want children, if at all? SI helps her think through timelines without pressure." },
          { title: "Measure", text: "AMH on the same assay plus an antral follicle count; FSH/estradiol on cycle days 2–4 if useful." },
          { title: "Consult", text: "A NEYU fertility physician reviews her numbers, expected egg yield, costs and risks." },
          { title: "Decide", text: "Freeze now, revisit in a year, or not at all — and OVEREO keeps the record either way." },
        ]}
      />
      <AskChips
        title="Questions worth asking a clinic"
        items={[
          { label: "How many eggs would you expect for me?", ask: "Should she think about egg freezing?" },
          { label: "Can AMH predict natural fertility?", ask: "Can AMH predict natural fertility?" },
          { label: "What does a cycle cost?", ask: "Should she think about egg freezing?" },
        ]}
      />
      <div className="row-actions">
        <Link className="btn" href="/specialties/fertility">
          <Icon name="clock" size={16} /> Fertility & egg freezing
        </Link>
        <Link className="btn ghost" href="/tests?tab=timing">
          <Icon name="calendar" size={16} /> When to draw FSH
        </Link>
      </div>
      <Sources items={[{ label: "Goldman et al., Human Reproduction (2017) — egg freezing outcome model", url: "https://doi.org/10.1093/humrep/dex008" }, ...sp.sources]} />
    </Panel>
  );
}

function Learn() {
  const sp = specialtyBySlug("fertility")!;
  return (
    <Panel>
      <div className="glass holo learn-hero">
        <Icon name="clock" size={22} />
        <p className="lede-sm">{OVARY_FACT.text}</p>
        <a className="small" href={OVARY_FACT.url} target="_blank" rel="noreferrer">
          {OVARY_FACT.source} <Icon name="arrow" size={12} />
        </a>
      </div>
      <SectionTitle kicker="Method" title="How the Ovarian Clock is calculated" />
      <div className="feat-grid">
        <div className="glass feat-card">
          <b>1 · Reference curve</b>
          <p className="small muted">AMH is compared against an age curve to estimate a "marker age" — the age at which her AMH would be typical.</p>
        </div>
        <div className="glass feat-card">
          <b>2 · Adjustments</b>
          <p className="small muted">FSH, cycle variability, family history of early menopause and epigenetic age shift the estimate, each shown with its contribution.</p>
        </div>
        <div className="glass feat-card">
          <b>3 · Honest uncertainty</b>
          <p className="small muted">A band, not a point. The prototype curve is illustrative — production will use a validated, assay-specific nomogram.</p>
        </div>
      </div>
      <SectionTitle kicker="Questions" title="Frequently asked" />
      <div className="faq">
        {sp.faqs.map((f) => (
          <details key={f.q} className="glass faq-item">
            <summary>
              {f.q} <Icon name="chevron" size={16} />
            </summary>
            <p className="small muted">{f.a}</p>
          </details>
        ))}
      </div>
      <Disclaimer />
    </Panel>
  );
}
