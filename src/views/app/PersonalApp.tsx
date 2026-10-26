"use client";

import { TodayScreen } from "./TodayScreen";
import { TrackScreen } from "./TrackScreen";
import { AgentsScreen, DiaryScreen, InboxScreen } from "./AgentsScreens";
import { MeScreen } from "./MeScreen";
import { RecapScreen } from "./RecapScreen";
import { WelcomeScreen } from "./WelcomeScreen";

/* Her personal space: one client view per screen, all reading the same space store. */
export type Screen = "today" | "track" | "agents" | "inbox" | "diary" | "me" | "recap" | "welcome";

export function PersonalApp({ screen, t, review }: { screen: Screen; t?: string; review?: boolean }) {
  switch (screen) {
    case "track":
      return <TrackScreen initial={t} review={review} />;
    case "agents":
      return <AgentsScreen />;
    case "inbox":
      return <InboxScreen />;
    case "diary":
      return <DiaryScreen />;
    case "me":
      return <MeScreen />;
    case "recap":
      return <RecapScreen />;
    case "welcome":
      return <WelcomeScreen />;
    default:
      return <TodayScreen />;
  }
}
