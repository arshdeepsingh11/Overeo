"use client";

import { useMemo, useState } from "react";
import { useStore, setNav, defaultNav, openSI } from "../core/store";
import { useDerived } from "../core/derived";
import { recommend, TIER_META, GOALS, SYMPTOMS, FAMILY, STAGES, CONTRACEPTION, type Rec, type Tier } from "../core/engines/recommend";
import { TESTS, CATEGORIES, EVIDENCE, type TestDef } from "../content/tests";
import { PageHero, Callout, SectionTitle, Sources, EmptyState, StatTiles, Disclaimer } from "../ui/Page";
import { SubTabs } from "../ui/Tabs";
import { CycleCalendar, type CalMarker } from "../ui/CycleCalendar";
import { Icon } from "../ui/Icon";
import { Segmented, Toggle } from "../tools/ToolKit";
import { fmtDate } from "../core/rng";
import { TabbedPage, Panel } from "./TabbedPage";

/* =====================================================================
   /tests — the Test Navigator. BioAro Labs and NEA tests recommended the
   scientific way: from her data and answers, first-line before premium,
   reused when recent, timed to her cycle, graded for evidence — and an
   honest list of what NOT to test yet.
   ===================================================================== */

function useNav() {
  const d = useDerived();
  const nav = useStore((s) => s.nav);
  const tools = useStore((s) => s.toolResults);
  const res = useMemo(() => recommend(d, nav, tools), [d, nav, tools]);
  return { d, nav, tools, res };
}

export function TestsView({ initialTab }: { initialTab?: string }) {
  const { res } = useNav();
  const n = (t: Tier) => res.recs.filter((r) => r.tier === t).length;
  return (
    <TabbedPage
      routeId="tests"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Test Navigator · BioAro Labs · NEA"
          title={
            <>
              The right test, at the right time — <span className="serif grad-text">or none at all.</span>
            </>
          }
          lede="Overeo SI reads her entries, labs and answers, then recommends only tests whose result would change a decision. Every suggestion shows why, when on her cycle, what it can't tell you, and how strong the evidence is."
          aside={
            <StatTiles
              items={[
                { label: "To discuss now", value: n("discuss") },
                { label: "Already covered", value: n("done") },
                { label: "Not needed yet", value: n("not-now") },
                { label: "Tests in catalog", value: TESTS.length },
              ]}
            />
          }
        />
      }
      narration={{
        navigator: "I pre-filled the questions from her data — change anything and the list re-ranks instantly.",
        timing: "Timing matters as much as the test: FSH on the wrong day is noise.",
        catalog: "Every test carries an evidence grade. Exploratory doesn't mean bad — it means it rarely changes a decision yet.",
        method: "We rank by usefulness, never by price.",
      }}
      panels={{
        navigator: () => <NavigatorPanel />,
        timing: () => <TimingPanel />,
        catalog: () => <CatalogPanel />,
        method: () => <MethodPanel />,
      }}
    />
  );
}

/* ------------------------------ For you ------------------------------ */

function NavigatorPanel() {
  const { nav, res } = useNav();
  const tiers: Tier[] = ["discuss", "consider", "later", "done", "not-now"];
  const toggle = (k: "goals" | "symptoms" | "family", id: string, on: boolean) => setNav({ [k]: on ? [...nav[k], id] : nav[k].filter((x) => x !== id) });
  return (
    <Panel className="nav-layout">
      <aside className="nav-q glass">
        <div className="nav-q-head">
          <b className="title-sm">About you</b>
          <button className="chip" onClick={() => setNav(defaultNav())}>
            <Icon name="refresh" size={13} /> Reset to SI's read
          </button>
        </div>
        <p className="faint small">Pre-filled by Overeo SI from her logs and goals. Edit anything — results update live.</p>
        <QGroup title="Goals">
          {GOALS.map((g) => (
            <Toggle key={g.id} on={nav.goals.includes(g.id)} onChange={(on) => toggle("goals", g.id, on)}>
              {g.label}
            </Toggle>
          ))}
        </QGroup>
        <QGroup title="Symptoms in the last 3 months">
          {SYMPTOMS.map((g) => (
            <Toggle key={g.id} on={nav.symptoms.includes(g.id)} onChange={(on) => toggle("symptoms", g.id, on)}>
              {g.label}
            </Toggle>
          ))}
        </QGroup>
        <QGroup title="Life stage">
          <Segmented value={nav.stage} options={STAGES} onChange={(v) => setNav({ stage: v })} label="Life stage" />
        </QGroup>
        <QGroup title="Contraception" hint="Hormonal methods change many results">
          <Segmented value={nav.contraception} options={CONTRACEPTION} onChange={(v) => setNav({ contraception: v })} label="Contraception" />
        </QGroup>
        <QGroup title="Family history">
          {FAMILY.map((g) => (
            <Toggle key={g.id} on={nav.family.includes(g.id)} onChange={(on) => toggle("family", g.id, on)}>
              {g.label}
            </Toggle>
          ))}
        </QGroup>
      </aside>
      <div className="nav-results">
        {res.urgent && (
          <Callout tone="alert" title="Seek care now">
            {res.urgent}
          </Callout>
        )}
        {res.recs.length === 0 && (
          <EmptyState icon="flask" title="Nothing to test right now" text="That's a good answer. Choose a goal or symptom on the left and SI will tell you if any test would help." />
        )}
        {tiers.map((t) => {
          const list = res.recs.filter((r) => r.tier === t);
          if (!list.length) return null;
          return (
            <section key={t} className={`tier tier-${t}`}>
              <div className="tier-head">
                <b>{TIER_META[t].label}</b>
                <span className="faint small">{TIER_META[t].desc}</span>
              </div>
              <div className="rec-list">
                {list.map((r, i) => (
                  <RecCard key={r.test.id} r={r} i={i} />
                ))}
              </div>
            </section>
          );
        })}
        <Disclaimer />
      </div>
    </Panel>
  );
}

function QGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="q-group">
      <span className="small">
        <b>{title}</b> {hint && <span className="faint">· {hint}</span>}
      </span>
      <div className="toggle-row">{children}</div>
    </div>
  );
}

function RecCard({ r, i }: { r: Rec; i: number }) {
  const [open, setOpen] = useState(false);
  const t = r.test;
  const ev = EVIDENCE[t.evidence];
  const quiet = r.tier === "done" || r.tier === "not-now";
  return (
    <article className={`rec glass ${quiet ? "quiet" : ""}`} style={{ ["--i" as string]: i }}>
      <div className="rec-top">
        <div>
          <b className="rec-name">{t.name}</b>
          <div className="rec-meta">
            <span className="badge">{t.provider}</span>
            <span className={`badge ${ev.tone}`} title={ev.desc}>
              {ev.label}
            </span>
            {t.rx && <span className="faint small">Clinician-ordered</span>}
            {t.price && <span className="faint small tnum">BioAro price {t.price} CAD</span>}
          </div>
        </div>
        <button className="icon-btn" aria-expanded={open} aria-label={open ? "Less" : "More about this test"} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "minus" : "plus"} size={16} />
        </button>
      </div>
      <ul className="rec-reasons">
        {r.reasons.slice(0, open ? 6 : 2).map((x) => (
          <li key={x.text}>
            <span className="rec-from">{x.from}</span> {x.text}
          </li>
        ))}
      </ul>
      {!quiet && (
        <p className={`rec-timing small ${r.timing.ok ? "" : "warn"}`}>
          <Icon name="calendar" size={14} /> {r.timing.label}
        </p>
      )}
      {open && (
        <div className="rec-more small">
          <p>
            <b>What it measures.</b> {t.what}
          </p>
          <p>
            <b>What it can tell you.</b> {t.tells}
          </p>
          <p>
            <b>What it can't.</b> {t.cannot}
          </p>
          <p>
            <b>Preparation.</b> {t.timingNote} · {t.sample}
          </p>
          <p>
            <b>Evidence.</b> {t.evidenceNote}
          </p>
          {r.caveats.map((c) => (
            <p key={c} className="rec-caveat">
              {c}
            </p>
          ))}
        </div>
      )}
      <div className="rec-actions">
        <button className="btn ghost sm" onClick={() => openSI(`Is a ${t.name.split(" (")[0].split(":")[0]} test worth it?`)}>
          <Icon name="sparkle" size={14} /> Ask SI
        </button>
        {t.url && (
          <a className="btn ghost sm" href={t.url} target="_blank" rel="noreferrer">
            On BioAro <Icon name="arrow" size={14} />
          </a>
        )}
      </div>
    </article>
  );
}

/* ------------------------------- Timing ------------------------------- */

function TimingPanel() {
  const { d, res } = useNav();
  const upcoming = res.recs.filter((r) => (r.tier === "discuss" || r.tier === "consider") && r.timing.window);
  const anyDay = res.recs.filter((r) => (r.tier === "discuss" || r.tier === "consider") && !r.timing.window);
  const markers: CalMarker[] = upcoming.map((r) => ({ id: r.test.id, label: r.test.name.split(" (")[0], from: r.timing.window![0], to: r.timing.window![1] }));
  return (
    <Panel className="timing">
      <SectionTitle kicker="Predicted from her last 6 cycles" title="When to test, on her cycle">
        Next period around {fmtDate(d.today.nextStart)} (±{Math.max(1, Math.round(d.today.sdLength))} days). Windows move automatically when a period is logged.
      </SectionTitle>
      <div className="timing-grid">
        <CycleCalendar d={d} days={42} markers={markers} />
        <div className="timing-list">
          {upcoming.length === 0 && anyDay.length === 0 && <EmptyState icon="calendar" title="No timed tests" text="Nothing that needs cycle timing is recommended right now." />}
          {upcoming.map((r) => (
            <div key={r.test.id} className="glass timing-item">
              <span className="timing-date tnum">
                {fmtDate(r.timing.window![0])}
                {r.timing.window![1].getTime() !== r.timing.window![0].getTime() && <> – {fmtDate(r.timing.window![1])}</>}
              </span>
              <b className="small">{r.test.name}</b>
              <span className="faint small">{r.timing.label}</span>
            </div>
          ))}
          {anyDay.length > 0 && (
            <div className="glass timing-item">
              <span className="timing-date">Any day</span>
              <b className="small">{anyDay.map((r) => r.test.name.split(" (")[0].split(":")[0]).join(" · ")}</b>
              <span className="faint small">Can share one draw — book home collection through NEYU.</span>
            </div>
          )}
          {res.hormoneHint && (
            <Callout tone="signal" title="Why some tests can't share a draw">
              {res.hormoneHint}
            </Callout>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------- Catalog ------------------------------- */

function CatalogPanel() {
  const { res } = useNav();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const tierOf = (id: string) => res.recs.find((r) => r.test.id === id)?.tier;
  const items = [{ id: "all", label: "All", count: TESTS.length }, ...CATEGORIES.map((c) => ({ id: c, label: c, count: TESTS.filter((t) => t.category === c).length }))];
  const list = TESTS.filter((t) => (cat === "all" || t.category === cat) && (!q || `${t.name} ${t.what} ${t.provider}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Panel>
      <div className="catalog-bar">
        <SubTabs items={items} active={cat} onSelect={setCat} label="Test categories" />
        <label className="search glass-thin">
          <Icon name="eye" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests" aria-label="Search tests" />
        </label>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="flask" title="No tests match" text={`Nothing in ${cat === "all" ? "the catalog" : cat} matches “${q}”. Try a marker name like “ferritin” or ask SI.`} action={{ label: "Ask SI", onClick: () => openSI(q ? `What does a ${q} test show?` : "Which tests should she take?") }} />
      ) : (
        <div className="catalog-grid">
          {list.map((t, i) => (
            <CatalogCard key={t.id} t={t} tier={tierOf(t.id)} i={i} />
          ))}
        </div>
      )}
      <p className="note">Prices are BioAro/NEYU published prices in CAD where available. Clinical tests are ordered by a NEYU physician and may be covered by provincial health insurance.</p>
    </Panel>
  );
}

function CatalogCard({ t, tier, i }: { t: TestDef; tier?: Tier; i: number }) {
  const ev = EVIDENCE[t.evidence];
  return (
    <article className="glass cat-card" style={{ ["--i" as string]: i }}>
      <div className="rec-meta">
        <span className="badge">{t.provider}</span>
        <span className={`badge ${ev.tone}`}>{ev.label}</span>
      </div>
      <b>{t.name}</b>
      <p className="small muted">{t.tells}</p>
      <p className="small">
        <span className="faint">Can't: </span>
        {t.cannot}
      </p>
      <div className="cat-foot small">
        <span className="faint">
          <Icon name="calendar" size={13} /> {t.timingNote}
        </span>
        {tier && <span className={`tier-chip ${tier}`}>{TIER_META[tier].label}</span>}
        {t.price && <span className="tnum faint">{t.price}</span>}
        {t.url && (
          <a href={t.url} target="_blank" rel="noreferrer">
            BioAro <Icon name="arrow" size={12} />
          </a>
        )}
      </div>
    </article>
  );
}

/* ------------------------------- Method ------------------------------- */

function MethodPanel() {
  return (
    <Panel className="method">
      <SectionTitle kicker="How we recommend" title="Science first. Never a shopping cart.">
        BioAro Labs and NEA are part of the OVEREO ecosystem — which is exactly why the rules are strict.
      </SectionTitle>
      <div className="principles">
        {[
          { icon: "target" as const, t: "Only if it changes a decision", d: "A test is suggested only when its result would change what happens next — a diagnosis, a treatment, a timing." },
          { icon: "layers" as const, t: "First-line before premium", d: "Standard clinical tests (often publicly covered) come before advanced panels. Panels are offered as depth, not as the start." },
          { icon: "refresh" as const, t: "Reuse, don't repeat", d: "A recent result on the same assay is reused. Repeating a stable marker early adds cost, not information." },
          { icon: "calendar" as const, t: "Timed to her cycle", d: "FSH on days 2–4, progesterone a week before a period, androgens early-cycle. Wrong-day results mislead." },
          { icon: "eye" as const, t: "Limits up front", d: "Every test says what it can't tell you, beside what it can." },
          { icon: "shield" as const, t: "Graded evidence", d: "Guideline-backed, established, emerging or exploratory — so curiosity tests are never sold as necessities." },
        ].map((p) => (
          <div key={p.t} className="glass principle">
            <span className="feat-ic">
              <Icon name={p.icon} size={18} />
            </span>
            <b>{p.t}</b>
            <p className="small muted">{p.d}</p>
          </div>
        ))}
      </div>
      <SectionTitle title="Evidence grades" />
      <div className="ev-legend">
        {(Object.keys(EVIDENCE) as (keyof typeof EVIDENCE)[]).map((k) => (
          <div key={k} className="glass ev-item">
            <span className={`badge ${EVIDENCE[k].tone}`}>{EVIDENCE[k].label}</span>
            <p className="small muted">{EVIDENCE[k].desc}</p>
            <span className="faint small">{TESTS.filter((t) => t.evidence === k).length} tests</span>
          </div>
        ))}
      </div>
      <Callout tone="good" title="What OVEREO will never do">
        Rank tests by price or margin · recommend an exploratory test as necessary · hide a limitation · use your answers for marketing. Recommendations prepare a conversation with a NEYU clinician; they don't replace one.
      </Callout>
      <Sources
        items={[
          { label: "International PCOS Guideline (2023)", url: "https://www.monash.edu/medicine/mchri/pcos/guideline" },
          { label: "NICE NG88 — Heavy menstrual bleeding", url: "https://www.nice.org.uk/guidance/ng88" },
          { label: "NICE NG23 — Menopause", url: "https://www.nice.org.uk/guidance/ng23" },
          { label: "Endocrine Society — Vitamin D guideline (2024)", url: "https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-for-prevention-of-disease" },
          { label: "CPIC — Pharmacogenomics guidelines", url: "https://cpicpgx.org/" },
          { label: "BioAro Labs — test catalog", url: "https://bioarolabs.com/" },
        ]}
      />
    </Panel>
  );
}
