"use client";

import Link from "next/link";
import { useDerived } from "../core/derived";
import { openSI } from "../core/store";
import { levelLabel, type SignalLevel } from "../core/engines/signals";
import { SPECIALTIES } from "../content/specialties";
import { FACTS } from "../core/research";
import { PageHero, SectionTitle, Callout, EmptyState, Sources, Disclaimer } from "../ui/Page";
import { Icon } from "../ui/Icon";
import { Radar } from "../sections/Radar";
import { TabbedPage, Panel } from "./TabbedPage";

/* /signals — the radar, how the engine works, and where each signal goes. */

export function SignalsView({ initialTab }: { initialTab?: string }) {
  const d = useDerived();
  const shown = d.signals.filter((s) => s.level !== "watch");
  return (
    <TabbedPage
      routeId="radar"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Silent Signals"
          title={
            <>
              {shown.length} pattern{shown.length === 1 ? "" : "s"} <span className="serif grad-text">worth a conversation.</span>
            </>
          }
          lede={`Read across ${d.profile.logs.length} days of her entries, labs and wearables. Strength means how consistently a pattern repeats — never the probability of a disease.`}
        />
      }
      narration={{
        method: "Strength is consistency across cycles. It's how I avoid calling one bad month a pattern.",
        route: "Every signal has a named team and a next step — nothing is left as just a warning.",
      }}
      panels={{
        radar: () => <Radar />,
        method: () => <Method />,
        route: () => <RoutePanel />,
      }}
    />
  );
}

const LEVELS: { id: SignalLevel; text: string }[] = [
  { id: "watch", text: "Seen, but not consistently. Kept in view; no action needed." },
  { id: "emerging", text: "Repeats in some cycles. Worth raising at the next routine visit." },
  { id: "strong", text: "Repeats in most cycles. Worth a dedicated conversation — the dossier is ready." },
  { id: "urgent", text: "Not a pattern — a safety issue. Bypasses everything and says what to do now." },
];

function Method() {
  return (
    <Panel>
      <SectionTitle kicker="How it works" title="Patterns, not predictions" />
      <div className="feat-grid">
        {[
          { t: "1 · Align to the cycle", d: "Every day is dated to her own cycle phase, learned from temperature and logs — not a textbook 28 days." },
          { t: "2 · Look for repeats", d: "A signal counts how many cycles show the same cluster (e.g. severe pain + bowel pain + heavy flow)." },
          { t: "3 · Cross-check sources", d: "Logs are checked against labs and wearables — falling ferritin backs up heavy flow and fatigue." },
          { t: "4 · Route to a person", d: "Each pattern names a team, the questions to ask, and a next step. SI never stops at a warning." },
        ].map((x) => (
          <div key={x.t} className="glass feat-card">
            <b>{x.t}</b>
            <p className="small muted">{x.d}</p>
          </div>
        ))}
      </div>
      <SectionTitle kicker="Levels" title="What each level means" />
      <div className="level-list">
        {LEVELS.map((l) => (
          <div key={l.id} className="glass level-item">
            <span className={`sig-dot ${l.id}`} />
            <b>{levelLabel[l.id]}</b>
            <span className="small muted">{l.text}</span>
          </div>
        ))}
      </div>
      <Callout tone="info" title="Limits">
        Signals don't diagnose. They can miss conditions that don't show up in logs, and they depend on what's entered. That's why the result is always a conversation with a clinician, with the evidence attached.
      </Callout>
      <Sources items={FACTS.slice(0, 3).map((f) => ({ label: f.source, url: f.url }))} />
    </Panel>
  );
}

function RoutePanel() {
  const d = useDerived();
  if (!d.signals.length)
    return (
      <Panel>
        <EmptyState icon="radar" title="No signals to route" text="Nothing in her entries repeats strongly enough yet. Daily check-ins are the fastest way to build a picture." />
      </Panel>
    );
  return (
    <Panel>
      <SectionTitle kicker="Send to care" title="Where each signal goes" />
      <div className="route-list">
        {d.signals.map((s, i) => {
          const sp = SPECIALTIES.find((x) => x.signals.includes(s.id));
          return (
            <div key={s.id} className={`glass route-card ${s.level}`} style={{ ["--i" as string]: i }}>
              <div className="spec-sig-head">
                <span className={`sig-dot ${s.level}`} />
                <b>{s.title}</b>
                <span className="faint small">{levelLabel[s.level]}</span>
              </div>
              <div className="route-flow small">
                <span className="glass-thin route-node">{s.short}</span>
                <Icon name="arrow" size={14} />
                <span className="glass-thin route-node">{s.route.team}</span>
                <Icon name="arrow" size={14} />
                <span className="glass-thin route-node">{s.route.via}</span>
              </div>
              {s.nextSteps.length > 0 && (
                <ul className="small">
                  {s.nextSteps.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <div className="row-actions">
                {sp && (
                  <Link className="btn ghost sm" href={`/specialties/${sp.slug}`}>
                    <Icon name={sp.icon} size={14} /> {sp.short}
                  </Link>
                )}
                {sp && s.level !== "urgent" && (
                  <Link className="btn ghost sm" href={`/care?tab=visit&spec=${sp.slug}`}>
                    <Icon name="users" size={14} /> Plan a visit
                  </Link>
                )}
                <button className="btn ghost sm" onClick={() => openSI(`Tell me more about ${s.title.toLowerCase()}`)}>
                  <Icon name="sparkle" size={14} /> Ask SI
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Disclaimer />
    </Panel>
  );
}
