"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useStore, openSI } from "../core/store";
import { useDerived } from "../core/derived";
import { recommend, TIER_META, type Tier } from "../core/engines/recommend";
import { STREAMS } from "../core/streams";
import { LAB_AREAS, LAB_TESTS, LABS_HOME, labHero, labIcon, labUrl, type LabArea, type LabTest } from "../content/bioaroLabs";
import { Icon } from "../ui/Icon";
import { Tilt } from "../ui/Controls";

/* =====================================================================
   BioAro Labs × OVEREO — real BioAro Labs tests, explained in plain
   language and ranked for her by the same engine as the Test Navigator.
   Pick one to bring it into the lens; every card links straight to
   that test's own page on bioarolabs.com.
   ===================================================================== */

type Filter = "for-her" | LabArea;

const TIER_ORDER: Tier[] = ["discuss", "consider", "later", "done", "not-now"];
const TIER_TONE: Record<Tier, string> = { discuss: "signal", consider: "good", later: "", done: "good", "not-now": "" };

interface Ranked {
  t: LabTest;
  tier: Tier;
  reason: string;
  timing?: string;
}

export function LabsShowcase() {
  const d = useDerived();
  const nav = useStore((s) => s.nav);
  const tools = useStore((s) => s.toolResults);
  const res = useMemo(() => recommend(d, nav, tools), [d, nav, tools]);

  const ranked: Ranked[] = useMemo(
    () =>
      LAB_TESTS.map((t) => {
        const rec = t.catalogId ? res.recs.find((r) => r.test.id === t.catalogId) : undefined;
        if (rec) return { t, tier: rec.tier, reason: rec.reasons[0]?.text ?? TIER_META[rec.tier].desc, timing: rec.timing.label };
        const fb = t.fallback ?? { tier: "later" as Tier, reason: TIER_META.later.desc };
        return { t, tier: fb.tier, reason: fb.reason };
      }),
    [res],
  );

  const [filter, setFilter] = useState<Filter>("for-her");
  const list = useMemo(() => {
    const xs = filter === "for-her" ? [...ranked].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)) : ranked.filter((r) => r.t.area === filter);
    return xs;
  }, [ranked, filter]);
  const [sel, setSel] = useState<string | null>(null);
  const current = list.find((r) => r.t.slug === sel) ?? list[0];
  const rail = useRef<HTMLDivElement>(null);

  return (
    <section id="bioaro-labs" className="section labs-show">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> BioAro Labs × OVEREO
          </span>
          <h2 className="title-lg">
            The tests behind <span className="serif grad-text">her streams.</span>
          </h2>
          <p className="lede">
            Real tests from BioAro Labs, explained in plain language — and ranked by what her data actually shows. A test is only worth taking if its result would change a decision.
          </p>
        </div>

        <div className="ls-filters" role="tablist" aria-label="Filter tests">
          {(["for-her", ...LAB_AREAS] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`chip ${filter === f ? "on" : ""}`}
              onClick={() => {
                setFilter(f);
                setSel(null);
                rail.current?.scrollTo({ left: 0, behavior: "smooth" });
              }}
            >
              {f === "for-her" ? (
                <>
                  <Icon name="sparkle" size={13} /> Ranked for {d.profile.name}
                </>
              ) : (
                f
              )}
            </button>
          ))}
        </div>

        {current && <Lens key={current.t.slug} r={current} name={d.profile.name} />}

        <div ref={rail} className="ls-rail" data-noswipe role="listbox" aria-label="BioAro Labs tests">
          {list.map((r, i) => (
            <button
              key={r.t.slug}
              role="option"
              aria-selected={current?.t.slug === r.t.slug}
              className={`ls-tile glass ${current?.t.slug === r.t.slug ? "on" : ""}`}
              style={{ ["--i" as string]: i } as CSSProperties}
              onClick={() => setSel(r.t.slug)}
            >
              <LabImage t={r.t} className="ls-tile-img" />
              <span className="ls-tile-body">
                <b>{r.t.name}</b>
                <span className="faint small">{r.t.area}</span>
                <span className={`badge ${TIER_TONE[r.tier]}`}>{TIER_META[r.tier].label}</span>
              </span>
            </button>
          ))}
        </div>

        <p className="ls-foot faint small">
          Test details from{" "}
          <a href={LABS_HOME} target="_blank" rel="noopener noreferrer" className="spop-src">
            bioarolabs.com <Icon name="external" size={11} />
          </a>
          . Not a diagnosis — BioAro Labs results are processed in CLIA-registered laboratories and should be discussed with a clinician. Rankings use {d.profile.name}'s sample data.
        </p>
      </div>
    </section>
  );
}

function Lens({ r, name }: { r: Ranked; name: string }) {
  const t = r.t;
  return (
    <div className="ls-lens glass holo">
      <Tilt className="ls-media" max={5}>
        <LabImage t={t} className="ls-hero" eager />
        <span className="ls-scan" aria-hidden="true" />
        <span className="ls-media-tags">
          {t.streams.map((s) => (
            <span key={s} className="ls-tag">
              <Icon name={STREAMS[s].icon} size={12} /> {STREAMS[s].label}
            </span>
          ))}
        </span>
      </Tilt>
      <div className="ls-info">
        <span className="eyebrow">
          <span className="dot" /> {t.area}
          {t.sub && <span className="faint"> · {t.sub}</span>}
        </span>
        <h3 className="title-md ls-name">{t.name}</h3>
        <p className="ls-tagline">{t.tagline}</p>
        <p className="ls-learn">{t.learn}</p>

        <dl className="ls-facts">
          <div>
            <dt>Sample</dt>
            <dd>{t.sample}</dd>
          </div>
          <div>
            <dt>Results</dt>
            <dd>{t.results}</dd>
          </div>
          <div>
            <dt>Measures</dt>
            <dd>{t.markers}</dd>
          </div>
          {t.prep && (
            <div>
              <dt>Before</dt>
              <dd>{t.prep}</dd>
            </div>
          )}
        </dl>

        <div className={`ls-for tier-${r.tier}`}>
          <span className="spop-k">
            <Icon name="sparkle" size={12} /> For {name} <span className={`badge ${TIER_TONE[r.tier]}`}>{TIER_META[r.tier].label}</span>
          </span>
          <p>{r.reason}</p>
          {r.timing && r.tier !== "done" && r.tier !== "not-now" && (
            <span className="faint small">
              <Icon name="calendar" size={12} /> {r.timing}
            </span>
          )}
        </div>

        <div className="ls-actions">
          <a className="btn sm" href={labUrl(t)} target="_blank" rel="noopener noreferrer">
            View on BioAro Labs <Icon name="external" size={15} />
          </a>
          <button className="btn ghost sm" onClick={() => openSI(`Should she take the ${t.name} test?`)}>
            <Icon name="sparkle" size={15} /> Ask SI
          </button>
          <Link className="btn ghost sm" href="/tests?tab=catalog">
            Test Navigator <Icon name="arrow" size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** BioAro's own product image; falls back to their test icon, then to a soft gradient. */
function LabImage({ t, className, eager = false }: { t: LabTest; className: string; eager?: boolean }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  if (stage === 2) return <span className={`${className} ls-img-fallback`} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${className} ${stage === 1 ? "is-icon" : ""}`}
      src={stage === 0 ? labHero(t) : labIcon(t)}
      alt={stage === 0 ? `${t.name} — BioAro Labs` : ""}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
    />
  );
}
