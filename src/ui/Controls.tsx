"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./Icon";
import { Spring } from "../lib/hooks";
import { tick } from "../lib/audio";

/* =====================================================================
   Interactive controls: Apple Dock, Dynamic pill navigation, Tilt
   (physics), Magnetic, Typewriter input, macOS Terminal.
   ===================================================================== */

/* --------------------------------- Dock ---------------------------------- */
export interface DockItem {
  id: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  divider?: boolean;
  /** the primary action: wider, labelled pill */
  featured?: boolean;
  /** hidden on phones (reachable from the Sections sheet instead) */
  hideOnMobile?: boolean;
}

/* macOS-style magnification. The spring loop only runs while the pointer
   is over the dock (or while icons settle back), and button positions are
   measured once on enter — no per-frame layout reads. */
export function Dock({ items }: { items: DockItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const springs = useRef<Spring[]>([]);
  const centers = useRef<number[]>([]);
  const mouse = useRef<number | null>(null);
  const raf = useRef(0);
  const lastT = useRef<number | null>(null);

  const loop = useRef<(now: number) => void>(() => {});
  loop.current = (now: number) => {
    const root = ref.current;
    if (!root) return;
    const btns = root.querySelectorAll<HTMLElement>("[data-dock-btn]");
    const dt = Math.min(0.033, (now - (lastT.current ?? now)) / 1000);
    lastT.current = now;
    let moving = false;
    btns.forEach((b, i) => {
      const s = (springs.current[i] ??= new Spring(1, 320, 28));
      const c = centers.current[i];
      if (mouse.current == null || c == null) s.target = 1;
      else {
        const d = Math.abs(mouse.current - c);
        s.target = 1 + 0.42 * Math.max(0, Math.cos(Math.min(Math.PI / 2, d / 110))) ** 2;
      }
      s.step(dt);
      if (!s.settled) moving = true;
      b.parentElement!.style.setProperty("--s", s.value.toFixed(3));
    });
    if (moving || mouse.current != null) raf.current = requestAnimationFrame((t) => loop.current(t));
    else {
      raf.current = 0;
      lastT.current = null;
    }
  };
  const kick = () => {
    if (!raf.current) raf.current = requestAnimationFrame((t) => loop.current(t));
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <nav className="dock-wrap" aria-label="Main navigation">
      <div
        ref={ref}
        className="dock glass"
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          centers.current = [...(ref.current?.querySelectorAll<HTMLElement>("[data-dock-btn]") ?? [])].map((b) => {
            const r = b.getBoundingClientRect();
            return r.left + r.width / 2;
          });
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          mouse.current = e.clientX;
          kick();
        }}
        onPointerLeave={() => {
          mouse.current = null;
          kick();
        }}
      >
        {items.map((it) => (
          <div key={it.id} className={`dock-slot ${it.hideOnMobile ? "hide-m" : ""}`}>
            {it.divider && <span className="dock-div" aria-hidden="true" />}
            <button
              data-dock-btn
              className={`dock-btn ${it.active ? "on" : ""} ${it.featured ? "featured" : ""}`}
              aria-label={it.label}
              aria-pressed={it.active}
              onClick={() => {
                tick(1400);
                it.onClick();
              }}
            >
              <Icon name={it.icon} size={23} />
              {it.featured && (
                <span className="dock-feat">
                  Ask SI <span className="kbd">O</span>
                </span>
              )}
              <span className="dock-tip glass-thin" role="tooltip">
                {it.label}
              </span>
            </button>
            {it.active && <span className="dock-dot" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </nav>
  );
}

/* ------------------------------ Dynamic nav ------------------------------ */
export function PillNav({ items, active, onSelect }: { items: { id: string; label: string }[]; active: string; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const target = hover ?? active;
  useLayoutEffect(() => {
    const root = ref.current;
    const el = root?.querySelector<HTMLElement>(`[data-id="${target}"]`);
    if (!root || !el) return;
    setBox({ x: el.offsetLeft, w: el.offsetWidth });
  }, [target, items]);
  return (
    <div ref={ref} className="pillnav glass-thin" role="tablist" onPointerLeave={() => setHover(null)}>
      {box && <span className="pillnav-hl" style={{ transform: `translateX(${box.x}px)`, width: box.w }} aria-hidden="true" />}
      {items.map((it) => (
        <button
          key={it.id}
          data-id={it.id}
          role="tab"
          aria-selected={active === it.id}
          className={`pillnav-btn ${active === it.id ? "on" : ""}`}
          onPointerEnter={() => setHover(it.id)}
          onClick={() => onSelect(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- Tilt --------------------------------- */
/* 3D tilt with spring physics and a holographic angle variable. */
export function Tilt({ children, className, max = 10, style }: { children: ReactNode; className?: string; max?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rx = new Spring(0, 180, 18);
    const ry = new Spring(0, 180, 18);
    let raf = 0;
    let running = false;
    let last = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      rx.step(dt);
      ry.step(dt);
      el.style.transform = `perspective(900px) rotateX(${rx.value}deg) rotateY(${ry.value}deg)`;
      el.style.setProperty("--holo-a", `${(ry.value * 12 + rx.value * 8).toFixed(1)}deg`);
      if (rx.settled && ry.settled) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      ry.target = px * max * 2;
      rx.target = -py * max * 2;
      el.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
      el.style.setProperty("--my", `${(py + 0.5) * 100}%`);
      kick();
    };
    const leave = () => {
      rx.target = 0;
      ry.target = 0;
      kick();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);
  return (
    <div ref={ref} className={`tilt ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}

/* -------------------------------- Magnetic ------------------------------- */
export function Magnetic({ children, strength = 0.28 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sx = new Spring(0, 220, 16);
    const sy = new Spring(0, 220, 16);
    let raf = 0;
    let last = performance.now();
    let active = false;
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      sx.step(dt);
      sy.step(dt);
      el.style.transform = `translate(${sx.value}px, ${sy.value}px)`;
      if (!active && sx.settled && sy.settled) return;
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      sx.target = (e.clientX - (r.left + r.width / 2)) * strength;
      sy.target = (e.clientY - (r.top + r.height / 2)) * strength;
      if (!active) {
        active = true;
        start();
      }
    };
    const leave = () => {
      active = false;
      sx.target = 0;
      sy.target = 0;
      start();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);
  return (
    <span ref={ref} className="magnetic">
      {children}
    </span>
  );
}

/* ---------------------------- Typewriter input --------------------------- */
export function TypewriterInput({
  value,
  onChange,
  placeholder,
  label,
  type = "text",
  error,
  onEnter,
  autoComplete,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  type?: string;
  error?: string | null;
  onEnter?: () => void;
  autoComplete?: string;
  name?: string;
}) {
  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (error) setShake((s) => s + 1);
  }, [error]);
  return (
    <label className={`tw ${error ? "err" : ""}`}>
      <span className="tw-label">{label}</span>
      <span key={shake} className={`tw-field glass-thin ${shake && error ? "shake" : ""}`}>
        <span className="tw-chars" aria-hidden="true">
          {value.length === 0 && <span className="tw-ph">{placeholder}</span>}
          {[...(type === "password" ? "•".repeat(value.length) : value)].map((c, i) => (
            <span key={i} className="tw-ch">
              {c === " " ? " " : c}
            </span>
          ))}
          <span className="tw-caret" />
        </span>
        <input
          className="tw-input"
          type={type}
          name={name}
          autoComplete={autoComplete}
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") onEnter?.();
          }}
          spellCheck={false}
        />
      </span>
      {error && <span className="tw-err">{error}</span>}
    </label>
  );
}

/* -------------------------------- Terminal ------------------------------- */
export interface TermLine {
  id: string;
  kind: "cmd" | "out" | "ok" | "warn" | "ask" | "dim";
  text: string;
}

export function Terminal({
  title,
  lines,
  onCommand,
  busy,
  prompt = "overeo",
  footer,
}: {
  title: string;
  lines: TermLine[];
  onCommand?: (cmd: string) => void;
  busy?: boolean;
  prompt?: string;
  footer?: ReactNode;
}) {
  const [cmd, setCmd] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const b = body.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [lines.length, busy]);
  return (
    <div className="term" onClick={() => input.current?.focus({ preventScroll: true })}>
      <div className="term-bar">
        <span className="tl r" />
        <span className="tl y" />
        <span className="tl g" />
        <span className="term-title">{title}</span>
      </div>
      <div ref={body} className="term-body mono" role="log" aria-live="polite">
        {lines.map((l) => (
          <div key={l.id} className={`tline ${l.kind}`}>
            {l.kind === "cmd" ? (
              <>
                <span className="tprompt">{prompt} ❯</span> {l.text}
              </>
            ) : (
              l.text
            )}
          </div>
        ))}
        {busy && (
          <div className="tline dim">
            <span className="tspin">⠋</span> working…
          </div>
        )}
        {onCommand && (
          <form
            className="tline cmd tinput-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!cmd.trim() || busy) return;
              onCommand(cmd.trim());
              setCmd("");
            }}
          >
            <span className="tprompt">{prompt} ❯</span>
            <input
              ref={input}
              className="tinput"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              aria-label="Agent command"
              placeholder="type help"
              spellCheck={false}
              autoComplete="off"
            />
          </form>
        )}
      </div>
      {footer && <div className="term-foot">{footer}</div>}
    </div>
  );
}
