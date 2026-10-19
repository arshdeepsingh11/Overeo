"use client";

import { useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { ScrollTrigger } from "../lib/gsap";
import { store, useStore, hydrateStore } from "../core/store";
import { setNavigator, routeIdFor } from "../core/routes";
import { narrateSection } from "../core/insights";
import { Backdrop, NavDock, CollabCursors, Toasts, useGlobalKeys, usePointerSheen } from "./Shell";
import { Footer } from "../sections/Join";

// Heavy, on-demand layers load only when first opened.
const OvereoSI = dynamic(() => import("../si/OvereoSI").then((m) => m.OvereoSI), { ssr: false });
const SpaceMode = dynamic(() => import("../space/SpaceMode").then((m) => m.SpaceMode), { ssr: false });
const ARMode = dynamic(() => import("../space/ARMode").then((m) => m.ARMode), { ssr: false });

/* =====================================================================
   The persistent app shell. It lives in the root layout, so the dock,
   Overeo SI, Space/AR, toasts and the live state survive every route
   change — only the page in <main> swaps. Every page reads the same
   profile, so a change on one tab is reflected on all of them.
   ===================================================================== */

export function AppShell({ children }: { children: ReactNode }) {
  useGlobalKeys();
  usePointerSheen();
  const router = useRouter();
  const pathname = usePathname();
  const mode = useStore((s) => s.mode);
  const siOpen = useStore((s) => s.siOpen);

  useEffect(() => {
    hydrateStore();
  }, []);

  // SI, the dock and the bus navigate through the Next router
  useEffect(() => {
    setNavigator((href) => router.push(href));
  }, [router]);

  // "where am I" for SI suggestions, insights and the dock
  useEffect(() => {
    const id = routeIdFor(pathname ?? "/");
    store.set({ activeSection: id });
    narrateSection(id);
  }, [pathname]);

  // Scroll-linked effects must be re-measured when the page height changes
  // (fonts, skeletons turning into charts, tab switches, route changes).
  useEffect(() => {
    const r = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(r);
    let deb = 0;
    let lastH = 0;
    const main = document.getElementById("main");
    const ro = new ResizeObserver(() => {
      const h = main?.scrollHeight ?? 0;
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      clearTimeout(deb);
      deb = window.setTimeout(r, 200);
    });
    if (main) ro.observe(main);
    return () => {
      clearTimeout(deb);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("mode-lock", mode !== "story");
  }, [mode]);

  return (
    <>
      <Backdrop />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <main id="main" aria-hidden={mode !== "story"}>
        {children}
      </main>
      <Footer />
      <CollabCursors />
      <NavDock />
      <Toasts />
      {mode === "space" && <SpaceMode />}
      {mode === "ar" && <ARMode />}
      {siOpen && <OvereoSI />}
    </>
  );
}
