"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "../../ui/Icon";
import { switchMode, useSpace } from "../../personal/space";
import { useT } from "../../personal/useT";
import { tick } from "../../lib/audio";

/* ------------------------------------------------------------------ *
 * Shared building blocks for her personal space.
 * ------------------------------------------------------------------ */

export function AppPage({ title, sub, icon, actions, children, wide = false }: { title: string; sub?: string; icon?: IconName; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`app-page ${wide ? "wide" : ""}`}>
      <div className="wrap app-wrap">
        <SpaceBanner />
        <header className="app-head">
          <div>
            <h1 className="app-title">
              {icon && (
                <span className="app-title-ic">
                  <Icon name={icon} size={20} />
                </span>
              )}
              {title}
            </h1>
            {sub && <p className="app-sub">{sub}</p>}
          </div>
          {actions && <div className="app-actions">{actions}</div>}
        </header>
        {children}
      </div>
    </section>
  );
}

/** Always visible: whose data this is. Sample and real never mix. */
export function SpaceBanner() {
  const t = useT();
  const mode = useSpace((s) => s.mode);
  const own = useSpace((s) => s.own);
  const ready = useSpace((s) => s.ready);
  if (!ready) return <div className="space-banner skel" aria-hidden="true" />;
  return (
    <div className={`space-banner ${mode}`} role="status">
      <span className="space-dot" />
      {mode === "sample" ? (
        <>
          <span className="space-label">
            <b>{t("space.sample")}</b> <span className="hide-sm">· {t("space.sampleNote")}</span>
          </span>
          {own ? (
            <button className="space-cta" onClick={() => switchMode("real")}>
              {t("space.switchMine")} <Icon name="arrow" size={14} />
            </button>
          ) : (
            <Link className="space-cta" href="/app/welcome">
              {t("space.create")} <Icon name="arrow" size={14} />
            </Link>
          )}
        </>
      ) : (
        <>
          <span className="space-label">
            <b>{t("space.mine")}</b> <span className="hide-sm">· {own?.name}</span>
          </span>
          <button className="space-cta ghost" onClick={() => switchMode("sample")}>
            {t("space.switchSample")}
          </button>
        </>
      )}
    </div>
  );
}

export function Card({ children, className = "", title, icon, action }: { children: ReactNode; className?: string; title?: string; icon?: IconName; action?: ReactNode }) {
  return (
    <div className={`acard ${className}`}>
      {title && (
        <div className="acard-head">
          <span className="acard-t">
            {icon && <Icon name={icon} size={15} />} {title}
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="aempty">
      <span className="aempty-ic">
        <Icon name={icon} size={22} />
      </span>
      <b>{title}</b>
      <p>{body}</p>
      {action}
    </div>
  );
}

/** iOS-style switch. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`aswitch ${on ? "on" : ""}`}
      onClick={() => {
        tick(on ? 1500 : 2300, 0.01);
        onChange(!on);
      }}
    >
      <span className="aswitch-knob" />
    </button>
  );
}

/** − value + — big targets, no keyboard needed. */
export function Stepper({ value, onChange, step = 1, min = -Infinity, max = Infinity, fmt, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; fmt?: (v: number) => string; label: string }) {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) * 100) / 100);
  return (
    <div className="astep" role="group" aria-label={label}>
      <button className="astep-b" onClick={() => set(value - step)} aria-label={`Decrease ${label}`}>
        <Icon name="minus" size={18} />
      </button>
      <b className="astep-v tnum">{fmt ? fmt(value) : value}</b>
      <button className="astep-b" onClick={() => set(value + step)} aria-label={`Increase ${label}`}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

/** Numeric keypad (blood pressure, PIN). */
export function KeyPad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="akeys">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
        k ? (
          <button
            key={i}
            className="akey"
            onClick={() => {
              tick(1800, 0.008);
              onKey(k);
            }}
            aria-label={k === "⌫" ? "Delete" : k}
          >
            {k}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    ref.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="asheet-root" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="asheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="asheet-head">
          <b>{title}</b>
          <button className="asheet-x" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="asheet-body">{children}</div>
      </div>
    </div>
  );
}

export function ago(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (d < 1) return "just now";
  if (d < 60) return `${Math.round(d)} min ago`;
  if (d < 60 * 24) return `${Math.round(d / 60)} h ago`;
  const days = Math.round(d / 1440);
  return days === 1 ? "yesterday" : days < 8 ? `${days} days ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const fmtDate = (d: Date | string, o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => new Date(d).toLocaleDateString(undefined, o);
export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Datetime-local value for an ISO string, in her timezone. */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
