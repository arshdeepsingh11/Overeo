"use client";

import type { ReactNode } from "react";
import { ROUTES, type TabDef } from "../core/routes";
import { usePageTabs, TabBar, TabPanels, useTabNarration } from "../ui/Tabs";
import { Page } from "../ui/Page";

/* A route with a hero, a sticky tab bar and lazily-rendered tab panels. */
export function TabbedPage({
  routeId,
  initialTab,
  hero,
  panels,
  narration = {},
  tabs: tabsOverride,
}: {
  routeId: string;
  initialTab?: string;
  hero: ReactNode;
  panels: Record<string, () => ReactNode>;
  narration?: Record<string, string>;
  tabs?: TabDef[];
}) {
  const route = ROUTES.find((r) => r.id === routeId);
  const tabs = tabsOverride ?? route?.tabs ?? [];
  const [tab, setTab] = usePageTabs(tabs, initialTab);
  useTabNarration(route?.label ?? routeId, tab, narration);
  return (
    <Page id={routeId}>
      {hero}
      {tabs.length > 1 && <TabBar tabs={tabs} active={tab} onSelect={setTab} label={`${route?.label ?? ""} sections`} />}
      <TabPanels tabs={tabs} active={tab} onSelect={setTab}>
        {panels[tab]?.()}
      </TabPanels>
    </Page>
  );
}

/** Standard padded container for a tab's own content. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`wrap panel-body ${className}`}>{children}</div>;
}
