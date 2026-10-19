"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "../core/store";
import { useDerived } from "../core/derived";
import { PHASE_META } from "../core/engines/forecast";
import { levelLabel } from "../core/engines/signals";
import { recommend, TIER_META } from "../core/engines/recommend";
import { ORGS } from "../core/ecosystem";
import { SPECIALTIES } from "../content/specialties";
import { EVIDENCE } from "../content/tests";
import { NumberTicker } from "../ui/Motion";
import { Tilt } from "../ui/Controls";
import { Icon, type IconName } from "../ui/Icon";
import { Hero } from "../sections/Hero";
import { MeetSI } from "../sections/MeetSI";
import { Converge } from "../sections/Converge";

/* =====================================================================
   Home — the hub. A short hero, then every area of the platform as a
   live tile (each shows her current number), Overeo SI's dedication,
   the specialties, the convergence story and the Test Navigator.
   Everything else lives in its own tab.
   ===================================================================== */

export function HomeView() {
  return (
    <>
      <Hero />
      <Hub />
      <MeetSI />
      <SpecialtyStrip />
      <Converge />
      <NavigatorTeaser />
    </>
  );
}

interface Tile {
  href: string;
  icon: IconName;
  title: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  sub: string;
  size?: "lg" | "md" | "sm";
  tone?: string;
}

function Hub() {
  const d = useDerived();
  const tools = useStore((s) => s.toolResults);
  const nav = useStore((s) => s.nav);
  const res = useMemo(() => recommend(d, nav, tools), [d, nav, tools]);
  const top = d.signals[0];
  const tiles: Tile[] = [
    { href: "/today", icon: "calendar", title: "Today", value: d.today.cycleDay, prefix: "Day ", sub: `${PHASE_META[d.today.phase].label} · next period in ${d.today.daysUntil} d`, size: "lg" },
    { href: "/signals", icon: "radar", title: "Silent Signals", value: d.signals.filter((s) => s.level !== "watch").length, suffix: " patterns", sub: top ? `${top.title} · ${levelLabel[top.level]}` : "Nothing repeating", size: "md", tone: top?.level },
    { href: "/clock", icon: "clock", title: "Ovarian Clock", value: d.clock.markerAge, decimals: 1, sub: `Marker age at ${d.clock.calendarAge}`, size: "md" },
    { href: "/tests", icon: "flask", title: "Test Navigator", value: res.recs.filter((r) => r.tier === "discuss").length, suffix: " to discuss", sub: `${res.recs.filter((r) => r.tier === "done" || r.tier === "not-now").length} not needed — and why`, size: "md" },
    { href: "/cycle", icon: "cycle", title: "Cycle", value: d.today.meanLength, decimals: 1, suffix: " d", sub: `Average · ±${d.today.sdLength} days`, size: "sm" },
    { href: "/future", icon: "trend", title: "Future Self", value: d.futures.gain, prefix: "+", suffix: " yrs", sub: d.futures.gain ? "Healthspan with levers on" : "Switch on a lever", size: "sm" },
    { href: "/tools", icon: "target", title: "Tools", value: Object.keys(tools).length, suffix: " / 6", sub: "Guided check-ins & questionnaires", size: "sm" },
    { href: "/specialties", icon: "layers", title: "Specialties", value: SPECIALTIES.length, sub: "Areas of women's care", size: "sm" },
    { href: "/care", icon: "users", title: "Care team", value: ORGS.length, suffix: " teams", sub: "One front door", size: "sm" },
    { href: "/research", icon: "globe", title: "Research", value: 770, sub: "Diseases diagnosed later in women", size: "sm" },
  ];
  return (
    <section id="hub" className="section hub">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> Your hub
          </span>
          <h2 className="title-lg">
            Everything about her, <span className="serif grad-text">one tap away.</span>
          </h2>
          <p className="lede">Each area has its own tabs and depth. Every number below is live — change something anywhere and it updates here.</p>
        </div>
        <div className="hub-grid">
          {tiles.map((t, i) => (
            <Link key={t.href} href={t.href} className={`hub-tile glass ${t.size ?? "sm"}`} style={{ ["--i" as string]: i }}>
              <span className="hub-top">
                <span className="feat-ic sm">
                  <Icon name={t.icon} size={16} />
                </span>
                <span className="small">{t.title}</span>
                <Icon name="arrow" size={14} />
              </span>
              <b className="hub-v tnum">
                <NumberTicker value={t.value} decimals={t.decimals ?? 0} prefix={t.prefix} suffix={t.suffix} duration={1.2} />
              </b>
              <span className="small muted hub-sub">
                {t.tone && <span className={`sig-dot ${t.tone}`} />} {t.sub}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpecialtyStrip() {
  const d = useDerived();
  const rel = (sig: string[]) => Math.max(0, ...d.signals.filter((s) => sig.includes(s.id)).map((s) => s.strength));
  const ranked = [...SPECIALTIES].sort((a, b) => rel(b.signals) - rel(a.signals));
  return (
    <section className="section spec-strip">
      <div className="wrap section-head">
        <span className="eyebrow">
          <span className="dot" /> Specialties
        </span>
        <h2 className="title-lg">
          Ten areas of care. <span className="serif grad-text">Each its own world.</span>
        </h2>
        <p className="lede">Conditions explained, the tests that matter, guided tools and a team — modelled on NEYU's specialty pages, ranked by her signals.</p>
      </div>
      <div className="strip-scroll" data-noswipe>
        {ranked.map((sp, i) => (
          <Tilt key={sp.slug} className="strip-item" max={6}>
            <Link href={`/specialties/${sp.slug}`} className="glass strip-card" style={{ ["--h" as string]: sp.hue, ["--i" as string]: i }}>
              <span className="feat-ic">
                <Icon name={sp.icon} size={20} />
              </span>
              <b className="title-sm">{sp.name}</b>
              <p className="small muted">{sp.tagline}</p>
              {rel(sp.signals) > 0 && <span className="badge signal">Relevant to her</span>}
              <span className="feat-cta small">
                Open <Icon name="arrow" size={14} />
              </span>
            </Link>
          </Tilt>
        ))}
      </div>
    </section>
  );
}

function NavigatorTeaser() {
  const d = useDerived();
  const tools = useStore((s) => s.toolResults);
  const nav = useStore((s) => s.nav);
  const res = useMemo(() => recommend(d, nav, tools), [d, nav, tools]);
  const show = [...res.recs.filter((r) => r.tier === "discuss").slice(0, 2), ...res.recs.filter((r) => r.tier === "done").slice(0, 1), ...res.recs.filter((r) => r.tier === "not-now").slice(0, 1)];
  return (
    <section className="section nav-teaser">
      <div className="wrap nav-teaser-grid">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> Test Navigator · BioAro Labs · NEA
          </span>
          <h2 className="title-lg">
            Science first. <span className="serif grad-text">Never a shopping cart.</span>
          </h2>
          <p className="lede">Tests are suggested only when the result would change a decision — timed to her cycle, graded for evidence, with what each can't tell you. Including the ones she doesn't need.</p>
          <Link className="btn" href="/tests">
            <Icon name="flask" size={18} /> Open the Test Navigator
          </Link>
        </div>
        <div className="teaser-recs">
          {show.map((r, i) => (
            <div key={r.test.id} className={`glass rec mini ${r.tier === "done" || r.tier === "not-now" ? "quiet" : ""}`} style={{ ["--i" as string]: i }}>
              <div className="rec-meta">
                <span className={`tier-chip ${r.tier}`}>{TIER_META[r.tier].label}</span>
                <span className={`badge ${EVIDENCE[r.test.evidence].tone}`}>{EVIDENCE[r.test.evidence].label}</span>
              </div>
              <b className="small">{r.test.name}</b>
              <span className="small muted">{r.reasons[0]?.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
