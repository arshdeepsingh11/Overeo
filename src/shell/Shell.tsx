"use client";

import { useEffect, useRef, useState } from "react";
import { store, useStore, openSI, closeSI, setTheme, setMood, toast, type Mood } from "../core/store";
import { useDerived } from "../core/derived";
import Link from "next/link";
import { run } from "../core/bus";
import { ROUTES } from "../core/routes";
import { SPECIALTIES } from "../content/specialties";
import { Dock } from "../ui/Controls";
import { Icon } from "../ui/Icon";
import { sound } from "../lib/audio";

/* =====================================================================
   Shell: calm backdrop + mood, the one bottom navigation (dock + sections
   sheet), collaboration cursors, toasts and global keyboard.
   ===================================================================== */

/* ------------------------------ Backdrop ------------------------------ */
export function Backdrop() {
  const mood = useStore((s) => s.mood);
  const hydrated = useStore((s) => s.hydrated);
  const d = useDerived();
  useEffect(() => {
    if (!hydrated) return;
    const compute = (): Exclude<Mood, "auto"> => {
      if (mood !== "auto") return mood;
      const h = new Date().getHours();
      if (h >= 21 || h < 6) return "night";
      const ph = d.today.phase;
      return ph === "menstrual" ? "calm" : ph === "luteal" ? "focus" : "energize";
    };
    document.documentElement.dataset.mood = compute();
    const t = setInterval(() => (document.documentElement.dataset.mood = compute()), 60_000);
    return () => clearInterval(t);
  }, [mood, d.today.phase, hydrated]);
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="wash" />
    </div>
  );
}

/* ------------------------------- Keyboard ------------------------------ */
export function useGlobalKeys() {
  useEffect(() => {
    let holdTimer = 0;
    let oDown = false;
    let talking = false;
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (store.get().siOpen) closeSI();
        else openSI();
        return;
      }
      if (e.key === "Escape") {
        if (store.get().siOpen) closeSI();
        else if (store.get().mode !== "story") store.set({ mode: "story" });
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "o" || e.key === "O") {
        if (e.repeat || oDown) return;
        oDown = true;
        e.preventDefault();
        if (!store.get().siOpen) openSI();
        holdTimer = window.setTimeout(() => {
          talking = true;
          store.set({ siListen: true });
        }, 450);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "o" || e.key === "O") {
        oDown = false;
        clearTimeout(holdTimer);
        if (talking) {
          talking = false;
          store.set({ siListen: false });
        }
      }
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
    };
  }, []);
}

/* -------------------- Glass sheen follows the pointer ------------------- */
export function usePointerSheen() {
  useEffect(() => {
    if (!matchMedia("(hover: hover)").matches) return;
    let raf = 0;
    let ev: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      if (!ev) return;
      const el = (ev.target as HTMLElement | null)?.closest?.(".glass") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      el.style.setProperty("--my", `${ev.clientY - r.top}px`);
    };
    const move = (e: PointerEvent) => {
      ev = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    addEventListener("pointermove", move, { passive: true });
    return () => {
      removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
}

/* ---------------------------- Navigation dock ---------------------------- */
const MOODS: Mood[] = ["auto", "calm", "focus", "energize", "night"];
const GROUPS = ["You", "Her biology", "Care", "Science", "OVEREO"] as const;

export function NavDock() {
  const mode = useStore((s) => s.mode);
  const theme = useStore((s) => s.theme);
  const active = useStore((s) => s.activeSection);
  const [sheet, setSheet] = useState(false);

  // close the sheet on Escape and whenever the page changes
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [sheet]);
  useEffect(() => setSheet(false), [active]);

  const story = mode === "story";
  return (
    <>
      {sheet && <SectionsSheet onClose={() => setSheet(false)} />}
      <Dock
        items={[
          { id: "home", icon: "home", label: "Home", onClick: () => run({ type: "goto", section: "hero" }), active: active === "hero" && story && !sheet },
          { id: "menu", icon: "grid", label: "Explore everything", onClick: () => setSheet((s) => !s), active: sheet },
          { id: "si", icon: "sparkle", label: "Ask Overeo SI · O", onClick: () => openSI(), featured: true, divider: true },
          { id: "clock", icon: "clock", label: "Ovarian Clock", onClick: () => run({ type: "goto", section: "clock" }), active: story && (active === "clock" || active === "lens"), hideOnMobile: true, divider: true },
          { id: "radar", icon: "radar", label: "Silent Signals", onClick: () => run({ type: "goto", section: "radar" }), active: story && active === "radar", hideOnMobile: true },
          { id: "future", icon: "trend", label: "Future Self", onClick: () => run({ type: "goto", section: "futures" }), active: story && active === "futures", hideOnMobile: true },
          { id: "space", icon: "cube", label: "Space · 3D dashboard", onClick: () => run({ type: "mode", value: mode === "space" ? "story" : "space" }), active: mode === "space", divider: true },
          { id: "ar", icon: "ar", label: "AR mode", onClick: () => run({ type: "mode", value: mode === "ar" ? "story" : "ar" }), active: mode === "ar", hideOnMobile: true },
          { id: "theme", icon: theme === "dark" ? "moon" : "sun", label: theme === "dark" ? "Dark · switch to light" : "Light · switch to dark", onClick: () => setTheme(theme === "dark" ? "light" : "dark"), divider: true },
        ]}
      />
    </>
  );
}

/** The platform map: every area, its tabs, and the ten specialties. */
function SectionsSheet({ onClose }: { onClose: () => void }) {
  const active = useStore((s) => s.activeSection);
  const mood = useStore((s) => s.mood);
  const collab = useStore((s) => s.collab);
  const [snd, setSnd] = useState(sound.enabled);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest(".dock")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div ref={ref} className="sheet glass-thick" role="dialog" aria-label="Explore OVEREO">
      <div className="sheet-grid">
        {GROUPS.map((g) => (
          <div key={g} className="sheet-group">
            <span className="sheet-g">{g}</span>
            {ROUTES.filter((r) => r.group === g).map((r) => (
              <Link key={r.id} href={r.path} className={`sheet-link ${active === r.id ? "on" : ""}`} onClick={onClose}>
                <Icon name={r.icon} size={15} />
                <span>
                  {r.label}
                  <span className="sheet-sub">{r.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        ))}
        <div className="sheet-group sheet-specs">
          <span className="sheet-g">Specialties</span>
          {SPECIALTIES.map((sp) => (
            <Link key={sp.slug} href={`/specialties/${sp.slug}`} className={`sheet-link ${active === `spec:${sp.slug}` ? "on" : ""}`} onClick={onClose}>
              <Icon name={sp.icon} size={15} />
              <span>{sp.name}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="sheet-row">
        <button
          className="chip"
          onClick={() => {
            onClose();
            run({ type: "mode", value: "ar" });
          }}
        >
          <Icon name="ar" size={14} /> AR mode
        </button>
        <button
          className="chip"
          onClick={() => {
            onClose();
            openSI(null, true);
          }}
        >
          <Icon name="mic" size={14} /> Talk to SI
        </button>
        <button
          className="chip"
          onClick={() => {
            const next = MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length];
            setMood(next);
            toast(`Mood lighting: ${next}${next === "auto" ? " — follows time and cycle" : ""}`);
          }}
        >
          <Icon name="mood" size={14} /> Mood · {mood}
        </button>
        <button className={`chip ${collab ? "on" : ""}`} onClick={() => store.set({ collab: !collab })}>
          <Icon name="users" size={14} /> Live cursors
        </button>
        <button
          className={`chip ${snd ? "on" : ""}`}
          onClick={() => {
            sound.set(!snd);
            setSnd(!snd);
          }}
        >
          <Icon name={snd ? "sound" : "mute"} size={14} /> Sound
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Collab cursors ---------------------------- */
const NAMES = ["Ava", "Noor", "Lena", "Priya", "Sofia", "Mei", "Zara", "Iris"];

interface Peer {
  id: string;
  name: string;
  hue: number;
  x: number;
  y: number;
  t: number;
}

export function CollabCursors() {
  const on = useStore((s) => s.collab);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const me = useRef({ id: "", name: "", hue: 0 });
  useEffect(() => {
    if (!on || typeof BroadcastChannel === "undefined") return;
    me.current = { id: Math.random().toString(36).slice(2), name: NAMES[(Math.random() * NAMES.length) | 0], hue: 320 + Math.random() * 40 };
    const ch = new BroadcastChannel("overeo-collab");
    let lastSend = 0;
    const send = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastSend < 50) return;
      lastSend = now;
      ch.postMessage({ type: "move", ...me.current, x: e.pageX / document.documentElement.scrollWidth, y: e.pageY / document.documentElement.scrollHeight });
    };
    ch.onmessage = (ev) => {
      const m = ev.data as Peer & { type: string };
      if (m.type === "bye") {
        setPeers((p) => {
          const n = { ...p };
          delete n[m.id];
          return n;
        });
        return;
      }
      if (m.type === "hello") ch.postMessage({ type: "move", ...me.current, x: -1, y: -1 });
      setPeers((p) => ({ ...p, [m.id]: { ...m, t: Date.now() } }));
    };
    ch.postMessage({ type: "hello", ...me.current, x: -1, y: -1 });
    addEventListener("pointermove", send, { passive: true });
    const bye = () => ch.postMessage({ type: "bye", id: me.current.id });
    addEventListener("pagehide", bye);
    return () => {
      bye();
      ch.close();
      removeEventListener("pointermove", send);
      removeEventListener("pagehide", bye);
      setPeers({});
    };
  }, [on]);
  useEffect(() => {
    store.set({ peers: Object.keys(peers).length + 1 });
  }, [peers]);
  if (!on) return null;
  return (
    <div className="collab" aria-hidden="true">
      {Object.values(peers)
        .filter((p) => p.x >= 0)
        .map((p) => (
          <div
            key={p.id}
            className="cursor"
            style={{
              transform: `translate(${p.x * document.documentElement.scrollWidth}px, ${p.y * document.documentElement.scrollHeight}px)`,
              ["--h" as string]: p.hue,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M4 3l7.5 18 2.3-7.4L21 11.5 4 3z" fill={`hsl(${p.hue} 40% 58%)`} stroke="#fff" strokeWidth="1.5" />
            </svg>
            <span className="cursor-name">{p.name}</span>
          </div>
        ))}
    </div>
  );
}

/* --------------------------------- Toasts -------------------------------- */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast glass-thin">
          <Icon name="sparkle" size={14} /> {t.text}
        </div>
      ))}
    </div>
  );
}
