"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore, openSI } from "../core/store";
import { useDerived } from "../core/derived";
import { recommend, TIER_META } from "../core/engines/recommend";
import { levelLabel } from "../core/engines/signals";
import { ORGS } from "../core/ecosystem";
import { ROUTES } from "../core/routes";
import { SPECIALTIES, type Specialty } from "../content/specialties";
import { testById, EVIDENCE } from "../content/tests";
import { PageHero, StatTiles, AskChips, Callout, SectionTitle, PathSteps, FeatureCard, Sources, Disclaimer, Page } from "../ui/Page";
import { usePageTabs, TabBar, TabPanels, SubTabs, useTabNarration } from "../ui/Tabs";
import { Icon } from "../ui/Icon";
import { Panel } from "./TabbedPage";

/* =====================================================================
   /specialties and /specialties/[slug] — one page per area of care,
   modelled on NEYU's specialty pages: Overview · Ask SI · Conditions ·
   Tests & care · Tools · Visit. Every section reads her live data.
   ===================================================================== */

const SPEC_TABS = [
  { id: "overview", label: "Overview" },
  { id: "ask", label: "Ask SI" },
  { id: "conditions", label: "Conditions" },
  { id: "tests", label: "Tests & care" },
  { id: "tools", label: "Tools & insights" },
  { id: "visit", label: "Visit" },
];

const orgName = (id: string) => ORGS.find((o) => o.id === id)?.name ?? id;

/** How strongly her current signals point to a specialty (0–1). */
function useRelevance() {
  const d = useDerived();
  return (sp: Specialty) => {
    const hits = d.signals.filter((s) => sp.signals.includes(s.id));
    return hits.length ? Math.max(...hits.map((s) => s.strength)) : 0;
  };
}

export function SpecialtiesIndex() {
  const rel = useRelevance();
  const ranked = [...SPECIALTIES].sort((a, b) => rel(b) - rel(a));
  return (
    <Page id="specialties">
      <PageHero
        eyebrow="Specialties"
        title={
          <>
            Ten areas of care. <span className="serif grad-text">One record.</span>
          </>
        }
        lede="Each specialty has its own team, conditions explained in plain language, the tests that matter, guided tools and a path to a visit — all reading the same profile. Ranked by what her signals point to."
      />
      <div className="wrap spec-grid">
        {ranked.map((sp, i) => {
          const r = rel(sp);
          return (
            <Link key={sp.slug} href={`/specialties/${sp.slug}`} className="glass spec-card" style={{ ["--h" as string]: sp.hue, ["--i" as string]: i }}>
              <span className="feat-ic">
                <Icon name={sp.icon} size={20} />
              </span>
              <b className="title-sm">{sp.name}</b>
              <p className="small muted">{sp.tagline}</p>
              <div className="spec-foot small">
                <span className="faint">
                  {sp.conditions.length} conditions · {sp.tests.length} tests · {orgName(sp.team[0])}
                </span>
                {r > 0 && <span className="badge signal">Relevant to her · {Math.round(r * 100)}%</span>}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="wrap">
        <Disclaimer />
      </div>
    </Page>
  );
}

export function SpecialtyView({ slug, initialTab }: { slug: string; initialTab?: string }) {
  const sp = SPECIALTIES.find((s) => s.slug === slug)!;
  const [tab, setTab] = usePageTabs(SPEC_TABS, initialTab);
  const d = useDerived();
  const rel = useRelevance()(sp);
  const sigs = d.signals.filter((s) => sp.signals.includes(s.id));
  useTabNarration(sp.short, tab, {
    overview: rel ? `${sp.name} is relevant to her: ${sigs[0]?.title.toLowerCase()} (${levelLabel[sigs[0]!.level].toLowerCase()}).` : `${sp.name}: ${sp.tagline}`,
    tests: "Tests here are ranked for her — first-line before premium, with timing on her cycle.",
    conditions: `${sp.conditions.length} conditions, each with signs, diagnosis, care and what OVEREO adds.`,
  });
  return (
    <Page id={`spec-${sp.slug}`}>
      <PageHero
        hue={sp.hue}
        eyebrow={
          <>
            <Link href="/specialties" className="crumb">
              Specialties
            </Link>{" "}
            · {orgName(sp.team[0])} · AI-assisted
          </>
        }
        title={sp.name}
        lede={sp.tagline}
        aside={
          <StatTiles
            items={[
              { label: "Conditions explained", value: sp.conditions.length },
              { label: "Related tests", value: sp.tests.length },
              { label: "Care teams", value: sp.team.length },
              { label: "Guided tools", value: sp.tools.length },
            ]}
          />
        }
      >
        {rel > 0 && (
          <div className="spec-relevance glass-thin">
            <span className={`sig-dot ${sigs[0]!.level}`} />
            <span className="small">
              Her data points here: <b>{sigs[0]!.title}</b> · {levelLabel[sigs[0]!.level]}
            </span>
          </div>
        )}
      </PageHero>
      <TabBar tabs={SPEC_TABS} active={tab} onSelect={setTab} label={`${sp.name} sections`} />
      <TabPanels tabs={SPEC_TABS} active={tab} onSelect={setTab}>
        {tab === "overview" && <Overview sp={sp} go={setTab} />}
        {tab === "ask" && <Ask sp={sp} />}
        {tab === "conditions" && <Conditions sp={sp} />}
        {tab === "tests" && <TestsCare sp={sp} />}
        {tab === "tools" && <ToolsInsights sp={sp} />}
        {tab === "visit" && <Visit sp={sp} />}
      </TabPanels>
    </Page>
  );
}

function Overview({ sp, go }: { sp: Specialty; go: (t: string) => void }) {
  return (
    <Panel className="spec-overview">
      <div className="spec-about">
        <div>
          <SectionTitle kicker="About" title={`About ${sp.short.toLowerCase()} care`} />
          <p className="lede-sm">{sp.about}</p>
        </div>
        <div className="glass when-card">
          <b>When to see us</b>
          <ul className="small">
            {sp.whenToSee.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
      {sp.urgent && (
        <Callout tone="alert" title="Don't wait">
          {sp.urgent}
        </Callout>
      )}
      <AskChips items={sp.symptoms} />
      <SectionTitle kicker="Your path" title="From pattern to plan, in four steps" />
      <PathSteps steps={sp.path} />
      <div className="feat-grid">
        <FeatureCard icon="sparkle" title="Ask Overeo SI" text="Questions about symptoms, tests or treatment — answered with her data and sources." onClick={() => go("ask")} cta="Ask" />
        <FeatureCard icon="flask" title="Tests & care" text="What to test, when on her cycle, and what each result can't tell you." onClick={() => go("tests")} cta="See tests" />
        <FeatureCard icon="users" title="Visit" text={`${sp.team.map(orgName).join(" · ")}. Virtual or in clinic, with the dossier attached.`} onClick={() => go("visit")} cta="Plan a visit" />
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
      <Sources items={sp.sources} />
      <Disclaimer />
    </Panel>
  );
}

function Ask({ sp }: { sp: Specialty }) {
  const prompts = [...sp.symptoms.map((s) => s.ask), ...sp.conditions.map((c) => c.ask), ...sp.faqs.map((f) => f.q)];
  const uniq = [...new Set(prompts)];
  return (
    <Panel className="spec-ask">
      <div className="glass holo ask-hero">
        <span className="feat-ic big">
          <Icon name="sparkle" size={26} />
        </span>
        <div>
          <b className="title-sm">Ask Overeo SI about {sp.short.toLowerCase()}</b>
          <p className="small muted">Grounded in her profile and this specialty's guides. SI shows what it used, what it didn't have, and its sources. Press O anywhere.</p>
        </div>
        <button className="btn" onClick={() => openSI()}>
          Ask anything <span className="kbd kbd-inv">O</span>
        </button>
      </div>
      <div className="prompt-grid">
        {uniq.map((p, i) => (
          <button key={p} className="glass prompt" style={{ ["--i" as string]: i }} onClick={() => openSI(p)}>
            <Icon name="sparkle" size={14} /> {p}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Conditions({ sp }: { sp: Specialty }) {
  const [c, setC] = useState(sp.conditions[0].id);
  const cond = sp.conditions.find((x) => x.id === c)!;
  return (
    <Panel className="spec-conditions">
      <SubTabs items={sp.conditions.map((x) => ({ id: x.id, label: x.name.split(" (")[0] }))} active={c} onSelect={setC} label="Conditions" />
      <article className="cond reveal-in" key={cond.id}>
        <div className="cond-head">
          <h3 className="title-md">{cond.name}</h3>
          <p className="lede-sm">{cond.summary}</p>
        </div>
        <div className="cond-grid">
          {[
            { t: "Signs & symptoms", l: cond.signs, icon: "eye" as const },
            { t: "How it's diagnosed", l: cond.diagnosis, icon: "flask" as const },
            { t: "Care options", l: cond.care, icon: "heart" as const },
          ].map((b) => (
            <div key={b.t} className="glass cond-box">
              <span className="small upper faint">
                <Icon name={b.icon} size={13} /> {b.t}
              </span>
              <ul className="small">
                {b.l.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="glass holo cond-overeo">
          <span className="feat-ic">
            <Icon name="sparkle" size={18} />
          </span>
          <div>
            <b>What OVEREO adds</b>
            <p className="small">{cond.overeo}</p>
          </div>
          <button className="btn ghost sm" onClick={() => openSI(cond.ask)}>
            Ask SI
          </button>
        </div>
      </article>
      <Sources items={sp.sources} />
    </Panel>
  );
}

function TestsCare({ sp }: { sp: Specialty }) {
  const d = useDerived();
  const nav = useStore((s) => s.nav);
  const tools = useStore((s) => s.toolResults);
  const res = useMemo(() => recommend(d, nav, tools), [d, nav, tools]);
  const rows = sp.tests.map((id) => ({ t: testById(id)!, r: res.recs.find((x) => x.test.id === id) })).filter((x) => x.t);
  const order = ["discuss", "consider", "later", "done", "not-now", undefined];
  rows.sort((a, b) => order.indexOf(a.r?.tier) - order.indexOf(b.r?.tier));
  return (
    <Panel>
      <SectionTitle kicker="Tests & care" title={`Tests for ${sp.short.toLowerCase()} — ranked for her`}>
        From BioAro Labs, NEA and NEYU clinicians. First-line before premium; timing from her predicted cycle.
      </SectionTitle>
      <div className="spec-tests">
        {rows.map(({ t, r }) => (
          <div key={t.id} className={`glass spec-test ${r?.tier ?? "none"}`}>
            <div>
              <b className="small">{t.name}</b>
              <div className="rec-meta">
                <span className="badge">{t.provider}</span>
                <span className={`badge ${EVIDENCE[t.evidence].tone}`}>{EVIDENCE[t.evidence].label}</span>
              </div>
              <p className="small muted">{r?.reasons[0]?.text ?? t.tells}</p>
              {r && r.tier !== "done" && r.tier !== "not-now" && (
                <p className="small rec-timing">
                  <Icon name="calendar" size={13} /> {r.timing.label}
                </p>
              )}
            </div>
            <span className={`tier-chip ${r?.tier ?? "none"}`}>{r ? TIER_META[r.tier].label : "Only if needed"}</span>
          </div>
        ))}
      </div>
      <div className="row-actions">
        <Link className="btn" href="/tests">
          <Icon name="flask" size={16} /> Open the full Test Navigator
        </Link>
        <Link className="btn ghost" href="/tests?tab=timing">
          <Icon name="calendar" size={16} /> Timing calendar
        </Link>
      </div>
      <Disclaimer />
    </Panel>
  );
}

const TOOL_META: Record<string, { icon: "calendar" | "target" | "waves" | "trend" | "heart" | "shield"; title: string; text: string }> = {
  checkin: { icon: "calendar", title: "Daily check-in", text: "Pain, flow, energy, sleep and mood — 30 seconds a day builds the pattern." },
  pain: { icon: "target", title: "Pain map", text: "Where and when it hurts, matched to guideline features." },
  pcos: { icon: "waves", title: "PCOS criteria", text: "The 2023 international criteria, pre-filled from her cycles." },
  mrs: { icon: "trend", title: "Menopause Rating Scale", text: "A validated 11-item score to repeat over time." },
  heart: { icon: "heart", title: "Heart check", text: "Red flags and women-specific risk enhancers." },
  bone: { icon: "shield", title: "Bone check", text: "Whether a bone scan is recommended yet." },
};

function ToolsInsights({ sp }: { sp: Specialty }) {
  const d = useDerived();
  const results = useStore((s) => s.toolResults);
  const sigs = d.signals.filter((s) => sp.signals.includes(s.id));
  return (
    <Panel>
      <SectionTitle kicker="Tools" title="Guided tools for this specialty" />
      <div className="feat-grid">
        {sp.tools.map((t) => (
          <FeatureCard key={t} icon={TOOL_META[t].icon} title={TOOL_META[t].title} text={results[t] ? `Last result: ${results[t].summary}` : TOOL_META[t].text} href={`/tools?tab=${t}`} cta={results[t] ? "Retake" : "Start"} />
        ))}
      </div>
      <SectionTitle kicker="Insights" title="What her data shows here" />
      {sigs.length ? (
        <div className="spec-sigs">
          {sigs.map((s) => (
            <div key={s.id} className="glass spec-sig">
              <div className="spec-sig-head">
                <span className={`sig-dot ${s.level}`} />
                <b>{s.title}</b>
                <span className="faint small">
                  {levelLabel[s.level]} · {Math.round(s.strength * 100)}% consistency
                </span>
              </div>
              <ul className="small">
                {s.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="small muted">{s.context}</p>
              <div className="row-actions">
                <Link className="btn ghost sm" href="/signals">
                  <Icon name="radar" size={14} /> Silent Signals
                </Link>
                <button className="btn ghost sm" onClick={() => openSI(`Tell me more about ${s.title.toLowerCase()}`)}>
                  <Icon name="sparkle" size={14} /> Ask SI
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty glass">
          <span className="empty-ic">
            <Icon name="check" size={22} />
          </span>
          <b>No patterns here yet</b>
          <p className="small muted">Nothing in her entries points to this specialty right now. The tools above are the fastest way to check — each takes a couple of minutes.</p>
        </div>
      )}
    </Panel>
  );
}

function Visit({ sp }: { sp: Specialty }) {
  const care = ROUTES.find((r) => r.id === "ecosystem")!;
  return (
    <Panel>
      <SectionTitle kicker="Visit" title="Who you'll see">
        In-house teams first. Partner clinics only for procedures we don't do ourselves.
      </SectionTitle>
      <div className="team-grid">
        {sp.team.map((id) => {
          const o = ORGS.find((x) => x.id === id)!;
          return (
            <div key={id} className="glass team-card" style={{ ["--h" as string]: o.hue }}>
              <span className="eco-ic">{o.name.slice(0, 1)}</span>
              <b>{o.name}</b>
              <span className="small muted">{o.role}</span>
              <p className="small">{o.gives}</p>
              <span className="faint small">
                <Icon name="pin" size={12} /> {o.city}
              </span>
            </div>
          );
        })}
      </div>
      <PathSteps steps={sp.path} />
      <div className="row-actions">
        <Link className="btn" href={`${care.path}?tab=visit&spec=${sp.slug}`}>
          <Icon name="users" size={16} /> Plan a {sp.short.toLowerCase()} visit
        </Link>
        <button className="btn ghost" onClick={() => openSI(`Who should she see for ${sp.short.toLowerCase()}?`)}>
          <Icon name="sparkle" size={16} /> Ask SI who fits
        </button>
      </div>
    </Panel>
  );
}
