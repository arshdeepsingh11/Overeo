"use client";

import { useState } from "react";
import { useStore, forgetEverything, toast } from "../core/store";
import { FACTS, OVARY_FACT, MENSTRUAL_FACT } from "../core/research";
import { SPECIALTIES } from "../content/specialties";
import { TESTS } from "../content/tests";
import { PageHero, SectionTitle, Callout, EmptyState, Page } from "../ui/Page";
import { SubTabs } from "../ui/Tabs";
import { NumberTicker } from "../ui/Motion";
import { Icon } from "../ui/Icon";
import { Commons } from "../sections/Commons";
import { Gap } from "../sections/Gap";
import { Privacy } from "../sections/Privacy";
import { Labs } from "../sections/Labs";
import { Join } from "../sections/Join";
import { AppScreens } from "../sections/AppScreens";
import { TabbedPage, Panel } from "./TabbedPage";

/* /research, /privacy, /labs and /join. */

/* ------------------------------- Research ------------------------------- */

export function ResearchView({ initialTab }: { initialTab?: string }) {
  return (
    <TabbedPage
      routeId="commons"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Research"
          title={
            <>
              Women's health has a data gap. <span className="serif grad-text">This is where it closes.</span>
            </>
          }
          lede="The Science Commons lets women contribute de-identified data — only if they choose, one use at a time — and the Evidence library shows every source OVEREO relies on."
        />
      }
      narration={{ evidence: "Every claim on OVEREO links back to a source you can read." }}
      panels={{
        commons: () => <Commons />,
        evidence: () => <Evidence />,
        gap: () => <Gap />,
      }}
    />
  );
}

function Evidence() {
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");
  const all = [
    ...FACTS.map((x) => ({ label: x.source, url: x.url, area: "Research", note: x.detail })),
    { label: OVARY_FACT.source, url: OVARY_FACT.url, area: "Research", note: OVARY_FACT.text },
    { label: MENSTRUAL_FACT.source, url: MENSTRUAL_FACT.url, area: "Research", note: MENSTRUAL_FACT.text },
    ...SPECIALTIES.flatMap((s) => s.sources.map((x) => ({ ...x, area: s.short, note: s.tagline }))),
    ...TESTS.filter((t) => t.url).map((t) => ({ label: `BioAro Labs — ${t.name}`, url: t.url!, area: "Tests", note: t.evidenceNote })),
  ];
  const uniq = all.filter((x, i) => all.findIndex((y) => y.url === x.url) === i);
  const areas = ["all", "Research", ...SPECIALTIES.map((s) => s.short), "Tests"];
  const list = uniq.filter((x) => (f === "all" || x.area === f) && (!q || `${x.label} ${x.note}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Panel>
      <div className="facts-strip">
        {FACTS.map((x) => (
          <a key={x.id} className="glass fact-card" href={x.url} target="_blank" rel="noreferrer">
            <b className="title-md tnum">
              <NumberTicker value={x.value} suffix={x.suffix} prefix={x.prefix} />
            </b>
            <span className="small">{x.label}</span>
            <span className="faint small">{x.source}</span>
          </a>
        ))}
      </div>
      <div className="catalog-bar">
        <SubTabs items={areas.map((a) => ({ id: a, label: a === "all" ? "All" : a, count: a === "all" ? uniq.length : uniq.filter((x) => x.area === a).length }))} active={f} onSelect={setF} label="Evidence areas" />
        <label className="search glass-thin">
          <Icon name="eye" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sources" aria-label="Search sources" />
        </label>
      </div>
      {list.length ? (
        <ul className="evidence-list">
          {list.map((x, i) => (
            <li key={x.url} className="glass" style={{ ["--i" as string]: i }}>
              <span className="badge">{x.area}</span>
              <a href={x.url} target="_blank" rel="noreferrer">
                <b className="small">{x.label}</b> <Icon name="arrow" size={12} />
              </a>
              <span className="faint small">{x.note}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="doc" title="No sources match" text="Try another word, or clear the filter." action={{ label: "Clear", onClick: () => (setQ(""), setF("all")) }} />
      )}
    </Panel>
  );
}

/* -------------------------------- Privacy -------------------------------- */

export function PrivacyView({ initialTab }: { initialTab?: string }) {
  return (
    <TabbedPage
      routeId="privacy"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Privacy"
          title={
            <>
              Her data. <span className="serif grad-text">Her rules.</span>
            </>
          }
          lede="Consent one use at a time. Genetic data off by default. Everything can be exported or erased."
        />
      }
      panels={{
        privacy: () => <Privacy />,
        controls: () => <Controls />,
      }}
    />
  );
}

function Controls() {
  const tools = useStore((s) => s.toolResults);
  const visits = useStore((s) => s.visits);
  const nav = useStore((s) => s.nav);
  const profile = useStore((s) => s.profile);
  const [confirm, setConfirm] = useState(false);
  const rows = [
    { k: "Daily entries", v: `${profile.logs.length} days`, d: "Cycle, pain, flow, sleep, energy" },
    { k: "Lab results", v: `${profile.labs.length} series`, d: "From BioAro Labs" },
    { k: "Tool results", v: `${Object.keys(tools).length}`, d: Object.values(tools).map((t) => t.title).join(", ") || "None yet" },
    { k: "Navigator answers", v: `${nav.goals.length + nav.symptoms.length + nav.family.length} answers`, d: "Goals, symptoms, family history" },
    { k: "Visit requests", v: `${visits.length}`, d: "Prepared on this device" },
    { k: "Genome", v: "Off", d: "Each use needs its own consent" },
  ];
  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), note: "OVEREO prototype export (sample data)", profile, toolResults: tools, navigator: nav, visits }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "overeo-export.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Export downloaded");
  };
  return (
    <Panel>
      <SectionTitle kicker="Controls" title="What OVEREO holds — and your switches" />
      <div className="marker-table glass" role="table" aria-label="Stored data">
        {rows.map((r) => (
          <div key={r.k} className="mt-row ctl" role="row">
            <span role="cell">
              <b className="small">{r.k}</b>
            </span>
            <span role="cell" className="tnum small">
              {r.v}
            </span>
            <span role="cell" className="small muted">
              {r.d}
            </span>
          </div>
        ))}
      </div>
      <div className="row-actions">
        <button className="btn ghost" onClick={exportAll}>
          <Icon name="doc" size={16} /> Export everything (JSON)
        </button>
        {!confirm ? (
          <button className="btn ghost danger" onClick={() => setConfirm(true)}>
            <Icon name="close" size={16} /> Erase everything
          </button>
        ) : (
          <span className="confirm glass-thin">
            <span className="small">Erase tool results, answers, visits and preferences on this device?</span>
            <button
              className="btn sm danger-solid"
              onClick={() => {
                forgetEverything();
                setConfirm(false);
                toast("Erased. Sample profile restored.");
              }}
            >
              Erase
            </button>
            <button className="btn ghost sm" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </span>
        )}
      </div>
      <Callout tone="info" title="In the prototype">
        Everything stays in this browser. In production, data is encrypted, stored in Canada, and shared with a clinician only when you approve that specific use.
      </Callout>
    </Panel>
  );
}

/* --------------------------------- Labs --------------------------------- */

export function LabsView() {
  return (
    <Page id="labs">
      <Labs />
    </Page>
  );
}

/* --------------------------------- Join --------------------------------- */

export function JoinView({ initialTab }: { initialTab?: string }) {
  return (
    <TabbedPage
      routeId="join"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Join"
          title={
            <>
              Be first. <span className="serif grad-text">Shape what it becomes.</span>
            </>
          }
          lede="No health data needed to join — just a name and an email."
        />
      }
      panels={{
        join: () => <Join />,
        app: () => <AppScreens />,
      }}
    />
  );
}
