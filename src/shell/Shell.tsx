"use client";

import { useEffect, useRef, useState } from "react";
import { store, useStore, openSI, closeSI, setTheme, setMood, toast, type Mood } from "../core/store";
import { useDerived } from "../core/derived";
import Link from "next/link";
import { run } from "../core/bus";
import { ROUTES } from "../core/routes";
import { SPECIALTIES } from "../content/specialties";
import { usePathname } from "next/navigation";
import { navigate } from "../core/routes";
import { useSpace } from "../personal/space";
import { useT } from "../personal/useT";
import { SparkleNav } from "./SparkleNav";
import type { IconName } from "../ui/Icon";
import { Icon } from "../ui/Icon";
import { sound, tick } from "../lib/audio";

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

/* ---------------------------- Navigation ---------------------------- */
const MOODS: Mood[] = ["auto", "calm", "focus", "energize", "night"];
const GROUPS = ["You", "Her biology", "Care", "Science", "OVEREO"] as const;

/** Which nav item a path belongs to. */
function navIdFor(path: string): string | null {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return "home";
  if (p.startsWith("/app/track")) return "track";
  if (p.startsWith("/app/agents") || p.startsWith("/app/inbox") || p.startsWith("/app/diary")) return "agents";
  if (p.startsWith("/app/me")) return "me";
  if (p.startsWith("/app")) return "today";
  if (p.startsWith("/signals")) return "signals";
  if (p.startsWith("/tests")) return "tests";
  if (p.startsWith("/care")) return "care";
  return null;
}

export function NavDock() {
  const t = useT();
  const theme = useStore((s) => s.theme);
  const active = useStore((s) => s.activeSection);
  const pending = useSpace((s) => s.inbox.filter((x) => x.status === "pending").length);
  const path = usePathname() ?? "/";
  const [sheet, setSheet] = useState(false);

  // close the sheet on Escape and whenever the page changes
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [sheet]);
  useEffect(() => setSheet(false), [active]);

  const go = (href: string) => () => {
    setSheet(false);
    navigate(href);
  };
  const current = sheet ? "more" : navIdFor(path);
  return (
    <>
      {sheet && <SectionsSheet onClose={() => setSheet(false)} />}
      <SparkleNav
        active={current}
        items={[
          { id: "home", label: t("nav.home"), onSelect: go("/") },
          { id: "today", label: t("nav.myspace"), onSelect: go("/app") },
          { id: "track", label: t("nav.track"), onSelect: go("/app/track") },
          { id: "agents", label: t("nav.agents"), icon: pending ? <span className="sn-badge" aria-label={`${pending} waiting`}>{pending}</span> : undefined, onSelect: go("/app/agents") },
          { id: "signals", label: t("nav.signals"), onSelect: go("/signals") },
          { id: "tests", label: t("nav.tests"), onSelect: go("/tests") },
          { id: "more", label: t("nav.more"), toggle: true, onSelect: () => setSheet((x) => !x) },
        ]}
        trailing={
          <>
            <button className="sn-si" onClick={() => openSI()} aria-label="Ask Overeo SI (press O)">
              <Icon name="sparkle" size={16} /> {t("nav.si")} <span className="kbd kbd-inv">O</span>
            </button>
            <button className="sn-icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}>
              <Icon name={theme === "dark" ? "moon" : "sun"} size={17} />
            </button>
          </>
        }
      />
      <MobileTabBar sheet={sheet} path={path} />
    </>
  );
}

/** Phones: her app — Today · Track · SI · Agents · Me. Everything else lives in Me → Explore and the logo. */
function MobileTabBar({ sheet, path }: { sheet: boolean; path: string }) {
  const t = useT();
  const pending = useSpace((s) => s.inbox.filter((x) => x.status === "pending").length);
  const cur = sheet ? null : navIdFor(path);
  const tabs: { id: string; icon: IconName; label: string; href: string; badge?: number }[] = [
    { id: "today", icon: "calendar", label: t("nav.today"), href: "/app" },
    { id: "track", icon: "plus", label: t("nav.track"), href: "/app/track" },
  ];
  const right: typeof tabs = [
    { id: "agents", icon: "bot", label: t("nav.agents"), href: "/app/agents", badge: pending },
    { id: "me", icon: "user", label: t("nav.me"), href: "/app/me" },
  ];
  const tab = (x: (typeof tabs)[number]) => (
    <button
      key={x.id}
      className={`mtab-btn ${cur === x.id ? "on" : ""} ${x.id === "track" ? "mtab-plus" : ""}`}
      aria-current={cur === x.id ? "page" : undefined}
      onClick={() => {
        tick(1400);
        navigate(x.href);
      }}
    >
      <span className="mtab-ic">
        <Icon name={x.icon} size={24} />
        {!!x.badge && <span className="mtab-badge">{x.badge}</span>}
      </span>
      <span className="mtab-l">{x.label}</span>
    </button>
  );
  return (
    <nav className="mtab glass-thick" aria-label="Main navigation">
      {tabs.map(tab)}
      <button
        className="mtab-si"
        aria-label="Ask Overeo SI"
        onClick={() => {
          tick(1400);
          openSI();
        }}
      >
        <span className="mtab-orb">
          <Icon name="sparkle" size={24} />
        </span>
        <span className="mtab-l">{t("nav.si")}</span>
      </button>
      {right.map(tab)}
    </nav>
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
      if (ref.current && !ref.current.contains(t) && !t.closest(".snav, .mtab")) onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div ref={ref} className="sheet glass-thick" role="dialog" aria-label="Explore OVEREO">
      <div className="sheet-grid">
        <div className="sheet-group">
          <span className="sheet-g">Your space</span>
          {(
            [
              ["/app", "calendar", "Today", "Your day and what's coming"],
              ["/app/track", "plus", "Track", "Log anything in two taps"],
              ["/app/agents", "bot", "Agents", "Helpers you train and trust"],
              ["/app/inbox", "inbox", "Inbox", "Suggestions waiting for you"],
              ["/app/diary", "book", "Diary", "Everything your agents did"],
              ["/app/recap", "play", "Weekly recap", "Your week in two minutes"],
              ["/app/me", "user", "Me", "What OVEREO knows · settings"],
            ] as const
          ).map(([h, ic, l, sub]) => (
            <Link key={h} href={h} className="sheet-link" onClick={onClose}>
              <Icon name={ic} size={15} />
              <span>
                {l}
                <span className="sheet-sub">{sub}</span>
              </span>
            </Link>
          ))}
        </div>
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
            run({ type: "mode", value: "space" });
          }}
        >
          <Icon name="cube" size={14} /> Space · 3D
        </button>
        <ThemeChip />
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

function ThemeChip() {
  const theme = useStore((s) => s.theme);
  return (
    <button className="chip" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Icon name={theme === "dark" ? "moon" : "sun"} size={14} /> {theme === "dark" ? "Dark" : "Light"}
    </button>
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
