"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { TAB_EVENT, type TabDef } from "../core/routes";
import { tick } from "../lib/audio";
import { pushInsight } from "../core/store";

/* =====================================================================
   Tabs — the platform's in-page navigation.
   - TabBar: sticky glass segmented control with a spring indicator,
     arrow-key navigation, horizontal scroll on phones.
   - usePageTabs: tab state synced to ?tab= (shareable, back-button safe)
     without Suspense, and to SI commands ("open the timing tab").
   - TabPanels: cinematic cross-fade + swipe left/right to change tab.
   - SubTabs: the second level (conditions, categories), same physics.
   ===================================================================== */

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function usePageTabs(tabs: TabDef[], initial?: string) {
  const ids = tabs.map((t) => t.id);
  const key = ids.join("|");
  const [tab, setTab] = useState(initial && ids.includes(initial) ? initial : ids[0]);
  useEffect(() => {
    const read = () => {
      const q = new URLSearchParams(location.search).get("tab");
      if (q && ids.includes(q)) setTab(q);
    };
    read();
    const onTab = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (ids.includes(id)) setTab(id);
    };
    addEventListener(TAB_EVENT, onTab);
    addEventListener("popstate", read);
    return () => {
      removeEventListener(TAB_EVENT, onTab);
      removeEventListener("popstate", read);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const select = (id: string) => {
    if (id === tab) return;
    setTab(id);
    const url = new URL(location.href);
    if (id === ids[0]) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    // Next.js syncs its router with the native History API
    history.replaceState(null, "", url.pathname + url.search);
  };
  return [tab, select] as const;
}

export function TabBar({ tabs, active, onSelect, label, sticky = true }: { tabs: TabDef[]; active: string; onSelect: (id: string) => void; label: string; sticky?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  useIsoLayout(() => {
    const root = ref.current;
    const el = root?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!root || !el) return;
    const measure = () => setBox({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    // keep the active tab in view on narrow screens
    const sc = root.querySelector<HTMLElement>(".tabbar-track");
    if (sc && sc.scrollWidth > sc.clientWidth) sc.scrollTo({ left: el.offsetLeft - sc.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [active, tabs.length]);
  const key = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onSelect(tabs[n].id);
    ref.current?.querySelector<HTMLElement>(`[data-tab="${tabs[n].id}"]`)?.focus();
  };
  return (
    <div className={`tabbar ${sticky ? "sticky" : ""}`} ref={ref}>
      <div className="tabbar-track glass-thin" role="tablist" aria-label={label} onKeyDown={key}>
        {box && <span className="tabbar-hl" aria-hidden="true" style={{ transform: `translateX(${box.x}px)`, width: box.w }} />}
        {tabs.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className={`tabbar-btn ${active === t.id ? "on" : ""}`}
            onClick={() => {
              tick(2200, 0.012);
              onSelect(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Animated tab content with swipe-to-change on touch screens. */
export function TabPanels({ tabs, active, onSelect, children }: { tabs: TabDef[]; active: string; onSelect: (id: string) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const dir = useRef(0);
  const prev = useRef(active);
  if (prev.current !== active) {
    dir.current = tabs.findIndex((t) => t.id === active) > tabs.findIndex((t) => t.id === prev.current) ? 1 : -1;
    prev.current = active;
  }
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let ok = false;
    const start = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      ok = e.touches.length === 1 && !t.closest("input,textarea,select,canvas,[data-noswipe],.tabbar,.sub-tabs");
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    };
    const end = (e: TouchEvent) => {
      if (!ok) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      const i = tabs.findIndex((t) => t.id === active);
      const n = dx < 0 ? i + 1 : i - 1;
      if (n >= 0 && n < tabs.length) {
        onSelect(tabs[n].id);
        el.closest(".page")?.querySelector(".tabbar")?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, [tabs, active, onSelect]);
  return (
    <div ref={ref} className="tab-panels">
      <div key={active} id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="tab-panel" style={{ ["--dir" as string]: dir.current }}>
        {children}
      </div>
    </div>
  );
}

/** Second-level tabs (local state). */
export function SubTabs({ items, active, onSelect, label }: { items: { id: string; label: string; count?: number }[]; active: string; onSelect: (id: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useIsoLayout(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-sub="${active}"]`);
    if (!el) return;
    const m = () => setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    m();
    const ro = new ResizeObserver(m);
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, [active, items.length]);
  return (
    <div className="sub-tabs" ref={ref} role="tablist" aria-label={label}>
      {box && <span className="sub-hl" aria-hidden="true" style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }} />}
      {items.map((it) => (
        <button key={it.id} data-sub={it.id} role="tab" aria-selected={active === it.id} className={`sub-btn ${active === it.id ? "on" : ""}`} onClick={() => onSelect(it.id)}>
          {it.label}
          {it.count != null && <span className="sub-count tnum">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Narrate a tab change into the live insights panel (once per tab). */
export function useTabNarration(page: string, tab: string, lines: Record<string, string>) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const k = `${page}:${tab}`;
    if (seen.current.has(k) || !lines[tab]) return;
    seen.current.add(k);
    pushInsight(lines[tab], page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab]);
}
