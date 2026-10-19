"use client";

import Link from "next/link";
import { useStore } from "../core/store";
import { useDerived } from "../core/derived";
import { run } from "../core/bus";
import { LEVERS } from "../core/engines/futures";
import { PageHero, SectionTitle, Callout, PathSteps, Sources, Disclaimer } from "../ui/Page";
import { Icon, type IconName } from "../ui/Icon";
import { Futures } from "../sections/Futures";
import { TabbedPage, Panel } from "./TabbedPage";

/* /future — the two-futures simulator, life-stage milestones and a
   menopause plan that starts years before menopause. */

export function FutureView({ initialTab }: { initialTab?: string }) {
  const d = useDerived();
  return (
    <TabbedPage
      routeId="futures"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Future Self"
          title={
            <>
              Two futures. <span className="serif grad-text">Five levers</span> between them.
            </>
          }
          lede={`An illustrative model from ${d.profile.age} to 80. Switch levers on and watch the trajectories diverge — every input is labelled with how strong its evidence is.`}
        />
      }
      narration={{
        milestones: "The decades ahead, with the checks that matter at each — none of them a surprise.",
        menopause: "The best menopause plan starts in the early 40s.",
      }}
      panels={{
        simulator: () => <Futures />,
        milestones: () => <Milestones />,
        menopause: () => <MenoPlan />,
      }}
    />
  );
}

const MILESTONES: { age: number; icon: IconName; title: string; text: string; href?: string }[] = [
  { age: 25, icon: "shield", title: "Cervical screening begins", text: "HPV-based screening, typically every 5 years where available.", href: "/tests?tab=catalog" },
  { age: 30, icon: "dna", title: "Peak bone mass", text: "Bone banked now lasts for decades. Strength training matters most here.", href: "/specialties/bone" },
  { age: 35, icon: "clock", title: "Fertility timeline decisions", text: "Egg freezing outcomes are best before the mid-30s. Ask with real numbers.", href: "/clock?tab=planning" },
  { age: 40, icon: "heart", title: "Heart prevention baseline", text: "Lipid screening from 40 (earlier with risk enhancers); Lp(a) once.", href: "/specialties/heart" },
  { age: 42, icon: "trend", title: "Perimenopause can begin", text: "Cycle changes, sleep and mood. Track with the Menopause Rating Scale.", href: "/tools?tab=mrs" },
  { age: 45, icon: "flask", title: "Breast & bowel screening", text: "Most provinces offer mammograms from 40–45 and colorectal screening from 50 — earlier with family history.", href: "/specialties/longevity" },
  { age: 51, icon: "moon", title: "Average age of menopause", text: "Heart and bone risk rise in the years after. Plan care, don't endure it.", href: "/specialties/menopause" },
  { age: 65, icon: "shield", title: "Bone density scan", text: "Recommended for all women 65+, earlier with risk factors.", href: "/tools?tab=bone" },
];

function Milestones() {
  const age = useStore((s) => s.profile.age);
  return (
    <Panel>
      <SectionTitle kicker="Milestones" title={`From ${age}, the decades ahead`} />
      <ol className="milestones">
        {MILESTONES.map((m, i) => {
          const past = m.age < age;
          const next = !past && MILESTONES.findIndex((x) => x.age >= age) === i;
          return (
            <li key={m.title} className={`ms ${past ? "past" : ""} ${next ? "next" : ""}`} style={{ ["--i" as string]: i }}>
              <span className="ms-age tnum">{m.age}</span>
              <span className="ms-dot" aria-hidden="true">
                <Icon name={m.icon} size={14} />
              </span>
              <div className="glass ms-card">
                <b className="small">
                  {m.title} {next && <span className="badge signal">Next for her</span>}
                </b>
                <p className="small muted">{m.text}</p>
                {m.href && (
                  <Link className="small" href={m.href}>
                    Open <Icon name="arrow" size={12} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <Disclaimer />
    </Panel>
  );
}

function MenoPlan() {
  const levers = useStore((s) => s.levers);
  const mrs = useStore((s) => s.toolResults.mrs);
  return (
    <Panel>
      <SectionTitle kicker="Menopause plan" title="Plan the transition — years ahead of it" />
      <PathSteps
        steps={[
          { title: "Now – early 40s", text: "Build bone and muscle, know your heart numbers, and log cycles so change is visible early." },
          { title: "Perimenopause", text: "Track symptoms with the MRS; discuss hormone therapy or non-hormonal options early — most women never ask." },
          { title: "The final period", text: "Diagnosed after 12 months without a period. Any bleeding after that should be checked." },
          { title: "The decades after", text: "Heart, bone, brain and pelvic health get their own plan, reviewed yearly." },
        ]}
      />
      <div className="feat-grid">
        <div className="glass feat-card">
          <b>Menopause Rating Scale</b>
          <p className="small muted">{mrs ? `Last: ${mrs.summary}` : "Not taken yet — a validated baseline takes two minutes."}</p>
          <Link className="feat-cta small" href="/tools?tab=mrs">
            {mrs ? "Retake" : "Take it"} <Icon name="arrow" size={14} />
          </Link>
        </div>
        <div className="glass feat-card">
          <b>Simulate it</b>
          <p className="small muted">Switch on menopause care and see how the illustrative trajectory changes.</p>
          <button
            className={`chip ${levers.menoCare ? "on" : ""}`}
            onClick={() => {
              run({ type: "lever", key: "menoCare", on: !levers.menoCare });
              run({ type: "goto", section: "futures:simulator" });
            }}
          >
            {LEVERS.find((l) => l.key === "menoCare")?.label} · {levers.menoCare ? "on" : "off"}
          </button>
        </div>
        <div className="glass feat-card">
          <b>Who helps</b>
          <p className="small muted">NEYU menopause clinicians, Advanced Cardiology for heart, BioMynd for sleep and mood, Biongevity for the long view.</p>
          <Link className="feat-cta small" href="/specialties/menopause">
            Menopause care <Icon name="arrow" size={14} />
          </Link>
        </div>
      </div>
      <Callout tone="good" title="Hormone therapy, in one line">
        For most healthy women under 60 or within 10 years of menopause, benefits for symptoms generally outweigh risks — but it's a personal decision made with a clinician.
      </Callout>
      <Sources items={[{ label: "The Menopause Society — 2022 position statement", url: "https://menopause.org/" }, { label: "NICE NG23 — Menopause", url: "https://www.nice.org.uk/guidance/ng23" }]} />
    </Panel>
  );
}
