"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { openSI, type ToolResult } from "../core/store";
import { Icon, type IconName } from "../ui/Icon";
import { tick } from "../lib/audio";

/* Shared building blocks for the guided tools. */

export function ToolFrame({ icon, title, intro, source, children }: { icon: IconName; title: string; intro: ReactNode; source?: { label: string; url: string }; children: ReactNode }) {
  return (
    <div className="tool glass">
      <div className="tool-head">
        <span className="tool-ic">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h3 className="title-sm">{title}</h3>
          <p className="small muted">{intro}</p>
          {source && (
            <a className="note" href={source.url} target="_blank" rel="noreferrer">
              Based on {source.label} <Icon name="arrow" size={11} />
            </a>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-l">
        <b className="small">{label}</b>
        {hint && <span className="faint small">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          role="radio"
          aria-checked={value === o.id}
          className={`seg-btn ${value === o.id ? "on" : ""}`}
          onClick={() => {
            tick(2000, 0.01);
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      className={`toggle-chip ${on ? "on" : ""}`}
      aria-pressed={on}
      onClick={() => {
        tick(on ? 1500 : 2300, 0.01);
        onChange(!on);
      }}
    >
      <span className="toggle-box" aria-hidden="true">
        {on && <Icon name="check" size={12} />}
      </span>
      {children}
    </button>
  );
}

export function Slider({ value, min, max, step = 1, onChange, label, fmt }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; fmt?: (v: number) => string }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ ["--p" as string]: `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <b className="tnum slider-v">{fmt ? fmt(value) : value}</b>
    </div>
  );
}

const LEVEL: Record<ToolResult["level"], { label: string; tone: string }> = {
  none: { label: "Nothing flagged", tone: "good" },
  low: { label: "Low", tone: "good" },
  moderate: { label: "Worth discussing", tone: "signal" },
  high: { label: "Discuss soon", tone: "signal" },
  urgent: { label: "Act now", tone: "alert" },
};

export function ResultCard({
  level,
  title,
  summary,
  points,
  next,
  ask,
  saved,
}: {
  level: ToolResult["level"];
  title: string;
  summary: string;
  points?: string[];
  next?: { label: string; href: string; icon?: IconName }[];
  ask?: string;
  saved?: boolean;
}) {
  const l = LEVEL[level];
  return (
    <div className={`result glass holo ${level}`} aria-live="polite">
      <div className="result-head">
        <span className={`badge ${l.tone}`}>{l.label}</span>
        {saved && (
          <span className="faint small">
            <Icon name="check" size={12} /> Saved · feeds the Test Navigator and your dossier
          </span>
        )}
      </div>
      <b className="title-sm">{title}</b>
      <p className="small">{summary}</p>
      {points && points.length > 0 && (
        <ul className="result-points small">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="result-actions">
        {next?.map((n) => (
          <Link key={n.href} href={n.href} className="btn ghost sm">
            {n.icon && <Icon name={n.icon} size={15} />} {n.label}
          </Link>
        ))}
        {ask && (
          <button className="btn ghost sm" onClick={() => openSI(ask)}>
            <Icon name="sparkle" size={15} /> Ask SI
          </button>
        )}
      </div>
    </div>
  );
}
