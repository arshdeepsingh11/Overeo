"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { openSI } from "../core/store";
import { NumberTicker } from "./Motion";
import { Icon, type IconName } from "./Icon";

/* =====================================================================
   Page building blocks shared by every tab of the platform, modelled on
   NEYU's specialty pages: hero, stat tiles, "ask about" chips, callouts,
   the four-step path, feature cards, source lists and smart empty states.
   ===================================================================== */

export function Page({ children, id }: { children: ReactNode; id: string }) {
  return (
    <div className="page" data-page={id}>
      {children}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lede,
  aside,
  children,
  hue,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  hue?: number;
}) {
  return (
    <header className={`page-hero wrap ${aside ? "has-aside" : ""}`} style={hue != null ? { ["--h" as string]: hue } : undefined}>
      <div className="page-hero-copy">
        <span className="eyebrow">
          <span className="dot" /> {eyebrow}
        </span>
        <h1 className="title-lg page-title">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children}
      </div>
      {aside && <div className="page-hero-aside">{aside}</div>}
    </header>
  );
}

export interface Stat {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  hint?: string;
}

export function StatTiles({ items }: { items: Stat[] }) {
  return (
    <div className="stat-tiles">
      {items.map((s) => (
        <div key={s.label} className="glass stat-tile">
          <b className="tnum">
            <NumberTicker value={s.value} decimals={s.decimals ?? 0} suffix={s.suffix} prefix={s.prefix} duration={1.2} />
          </b>
          <span className="small muted">{s.label}</span>
          {s.hint && <span className="faint small">{s.hint}</span>}
        </div>
      ))}
    </div>
  );
}

export function AskChips({ title = "Tap any topic and Overeo SI explains it", items }: { title?: string; items: { label: string; ask: string }[] }) {
  return (
    <div className="ask-chips">
      <span className="small muted">
        <Icon name="sparkle" size={14} /> {title}
      </span>
      <div className="ask-row">
        {items.map((it) => (
          <button key={it.label} className="chip ask-chip" onClick={() => openSI(it.ask)}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Callout({ tone = "info", icon, title, children }: { tone?: "info" | "alert" | "good" | "signal"; icon?: IconName; title: string; children: ReactNode }) {
  return (
    <div className={`callout glass ${tone}`} role={tone === "alert" ? "alert" : undefined}>
      <span className="callout-ic">
        <Icon name={icon ?? (tone === "alert" ? "heart" : tone === "good" ? "check" : "eye")} size={18} />
      </span>
      <div>
        <b>{title}</b>
        <div className="small">{children}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ kicker, title, children }: { kicker?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="sec-title">
      {kicker && <span className="faint small upper">{kicker}</span>}
      <h2 className="title-md">{title}</h2>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

/** "Your path" — four steps with a beam that fills as it scrolls into view. */
export function PathSteps({ steps }: { steps: { title: string; text: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && el.classList.add("in"), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <ol className="path-steps" ref={ref}>
      {steps.map((s, i) => (
        <li key={s.title} className="glass path-step" style={{ ["--i" as string]: i }}>
          <span className="path-n tnum">{i + 1}</span>
          <b>{s.title}</b>
          <p className="small muted">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function FeatureCard({ icon, title, text, href, onClick, cta, hue, children }: { icon: IconName; title: string; text: string; href?: string; onClick?: () => void; cta?: string; hue?: number; children?: ReactNode }) {
  const body = (
    <>
      <span className="feat-ic">
        <Icon name={icon} size={20} />
      </span>
      <b className="title-sm">{title}</b>
      <p className="small muted">{text}</p>
      {children}
      {(href || onClick) && (
        <span className="feat-cta small">
          {cta ?? "Open"} <Icon name="arrow" size={14} />
        </span>
      )}
    </>
  );
  const style = hue != null ? { ["--h" as string]: hue } : undefined;
  if (href)
    return (
      <Link href={href} className="glass feat-card" style={style}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button className="glass feat-card" style={style} onClick={onClick}>
        {body}
      </button>
    );
  return (
    <div className="glass feat-card" style={style}>
      {body}
    </div>
  );
}

export function Sources({ items }: { items: { label: string; url: string }[] }) {
  return (
    <div className="sources">
      <span className="faint small upper">Sources</span>
      <ul>
        {items.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="small">
              {s.label} <Icon name="arrow" size={12} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Smart empty state: says why it's empty and offers the one action that fills it. */
export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="empty glass">
      <span className="empty-ic">
        <Icon name={icon} size={22} />
      </span>
      <b>{title}</b>
      <p className="small muted">{text}</p>
      {action && (
        <button className="btn sm" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="note disclaimer">
      Educational information reviewed against the sources listed — not a diagnosis. Sample data ("Maya") throughout. In an emergency call 911.
    </p>
  );
}
