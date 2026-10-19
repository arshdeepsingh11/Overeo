"use client";

import { useEffect, useState } from "react";
import { useStore, addVisit, toast, pushInsight, openSI } from "../core/store";
import { useDerived } from "../core/derived";
import { ORGS, HUBS } from "../core/ecosystem";
import { SPECIALTIES } from "../content/specialties";
import { PageHero, SectionTitle, Callout, StatTiles, EmptyState } from "../ui/Page";
import { Icon } from "../ui/Icon";
import { Segmented, Toggle } from "../tools/ToolKit";
import { Ecosystem } from "../sections/Ecosystem";
import { Agent } from "../sections/Agent";
import { chime } from "../lib/audio";
import { TabbedPage, Panel } from "./TabbedPage";

/* /care — the ecosystem orbit, planning a visit, the agent and the directory. */

export function CareView({ initialTab }: { initialTab?: string }) {
  return (
    <TabbedPage
      routeId="ecosystem"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Care team"
          title={
            <>
              One front door. <span className="serif grad-text">Twelve teams</span> behind it.
            </>
          }
          lede="NEYU physicians, BioAro Labs, Advanced Cardiology, NEA, Biongevity and more — connected through one record, so you never retell your story."
          aside={
            <StatTiles
              items={[
                { label: "In-house teams", value: ORGS.length },
                { label: "Hubs", value: HUBS.length },
                { label: "Specialties", value: SPECIALTIES.length },
              ]}
            />
          }
        />
      }
      narration={{
        ecosystem: "Drag the orbit — each team shows how her data would route there.",
        visit: "I've pre-selected the specialty her strongest signal points to.",
        agent: "I draft the plan; nothing happens until you approve each step.",
      }}
      panels={{
        ecosystem: () => <Ecosystem compact />,
        visit: () => <VisitPlanner />,
        agent: () => <Agent />,
        team: () => <Directory />,
      }}
    />
  );
}

const SHARE = [
  { id: "dossier", label: "Signal dossier", on: true },
  { id: "labs", label: "Lab history", on: true },
  { id: "cycle", label: "Cycle & symptom logs", on: true },
  { id: "wearables", label: "Wearable trends", on: false },
  { id: "tools", label: "Tool results", on: true },
  { id: "genome", label: "Genome results", on: false },
];

function VisitPlanner() {
  const d = useDerived();
  const visits = useStore((s) => s.visits);
  const ranked = [...SPECIALTIES].sort((a, b) => score(b) - score(a));
  function score(s: (typeof SPECIALTIES)[number]) {
    const hits = d.signals.filter((x) => s.signals.includes(x.id));
    return hits.length ? Math.max(...hits.map((x) => x.strength)) : 0;
  }
  const [spec, setSpec] = useState(ranked[0].slug);
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("spec");
    if (q && SPECIALTIES.some((s) => s.slug === q)) setSpec(q);
  }, []);
  const sp = SPECIALTIES.find((s) => s.slug === spec)!;
  const [team, setTeam] = useState(sp.team[0]);
  useEffect(() => setTeam(sp.team[0]), [sp]);
  const [kind, setKind] = useState<"virtual" | "clinic" | "home-draw">("virtual");
  const [share, setShare] = useState<string[]>(SHARE.filter((s) => s.on).map((s) => s.id));
  const submit = () => {
    addVisit({ specialty: sp.slug, team, kind, share });
    toast(`Visit request prepared for ${ORGS.find((o) => o.id === team)?.name}`);
    pushInsight(`Prepared a ${kind === "virtual" ? "virtual" : kind === "clinic" ? "clinic" : "home blood-draw"} request for ${sp.short.toLowerCase()} with ${share.length} item${share.length === 1 ? "" : "s"} shared.`, "Visit", "good");
    chime();
  };
  return (
    <Panel className="visit">
      <div className="visit-grid">
        <div className="glass visit-form">
          <Step n={1} title="What's it about?">
            <div className="toggle-row">
              {ranked.map((s, i) => (
                <button key={s.slug} className={`chip ${spec === s.slug ? "on" : ""}`} onClick={() => setSpec(s.slug)}>
                  {s.short}
                  {i === 0 && score(s) > 0 && spec !== s.slug && <span className="faint"> · suggested</span>}
                </button>
              ))}
            </div>
          </Step>
          <Step n={2} title="Which team?">
            <Segmented value={team} options={sp.team.map((id) => ({ id, label: ORGS.find((o) => o.id === id)!.name }))} onChange={setTeam} label="Team" />
          </Step>
          <Step n={3} title="How?">
            <Segmented
              value={kind}
              options={[
                { id: "virtual", label: "Virtual visit" },
                { id: "clinic", label: "In clinic" },
                { id: "home-draw", label: "Home blood draw" },
              ]}
              onChange={setKind}
              label="Visit type"
            />
          </Step>
          <Step n={4} title="What to share?" hint="Genome stays off unless you switch it on">
            <div className="toggle-row">
              {SHARE.map((s) => (
                <Toggle key={s.id} on={share.includes(s.id)} onChange={(on) => setShare((x) => (on ? [...x, s.id] : x.filter((y) => y !== s.id)))}>
                  {s.label}
                </Toggle>
              ))}
            </div>
          </Step>
          <div className="tool-foot">
            <button className="btn" onClick={submit}>
              Prepare request
            </button>
            <button className="btn ghost sm" onClick={() => openSI(`What should she ask at a ${sp.short.toLowerCase()} visit?`)}>
              <Icon name="sparkle" size={14} /> Questions to ask
            </button>
          </div>
          <p className="note">Prototype: requests are prepared on this device, not sent. In production they arrive in the clinician's BioEMR record.</p>
        </div>
        <div className="visit-side">
          <div className="glass holo visit-summary">
            <span className="faint small upper">Summary</span>
            <b className="title-sm">{sp.name}</b>
            <span className="small">
              {ORGS.find((o) => o.id === team)?.name} · {kind === "virtual" ? "Virtual" : kind === "clinic" ? "Calgary clinic" : "Home collection"}
            </span>
            <span className="faint small">Sharing: {share.length ? SHARE.filter((s) => share.includes(s.id)).map((s) => s.label).join(", ") : "nothing"}</span>
            {sp.urgent && (
              <Callout tone="alert" title="If it's urgent">
                {sp.urgent}
              </Callout>
            )}
          </div>
          <SectionTitle title="Prepared requests" />
          {visits.length ? (
            <ul className="visit-list">
              {visits.map((v) => (
                <li key={v.id} className="glass">
                  <Icon name="calendar" size={15} />
                  <span className="small">
                    <b>{SPECIALTIES.find((s) => s.slug === v.specialty)?.short}</b> · {ORGS.find((o) => o.id === v.team)?.name} · {v.kind}
                  </span>
                  <span className="faint small">{new Date(v.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="calendar" title="No requests yet" text="Pick a specialty and team — your dossier goes with it, so the first minutes of the visit aren't spent on history." />
          )}
        </div>
      </div>
    </Panel>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="v-step">
      <span className="crit-n">{n}</span>
      <div>
        <b className="small">
          {title} {hint && <span className="faint">· {hint}</span>}
        </b>
        {children}
      </div>
    </div>
  );
}

function Directory() {
  return (
    <Panel>
      <SectionTitle kicker="Directory" title="Every team, and what they do for her" />
      <div className="team-grid">
        {ORGS.map((o, i) => (
          <div key={o.id} className="glass team-card" style={{ ["--h" as string]: o.hue, ["--i" as string]: i }}>
            <span className="eco-ic">{o.name.slice(0, 1)}</span>
            <b>{o.name}</b>
            <span className="small muted">{o.role}</span>
            <p className="small">{o.gives}</p>
            <div className="row-actions">
              <span className="faint small">
                <Icon name="pin" size={12} /> {o.city}
              </span>
              {o.url && (
                <a className="small" href={o.url} target="_blank" rel="noreferrer">
                  Website <Icon name="arrow" size={12} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
