import { useMemo } from "react";
import { useStore, type Levers } from "./store";
import type { Profile } from "./persona";
import { computeClock, type ClockResult } from "./engines/clock";
import { computeSignals, type Signal } from "./engines/signals";
import { cycleToday, type Today } from "./engines/forecast";
import { simulate, type FutureResult } from "./engines/futures";

export interface Derived {
  profile: Profile;
  clock: ClockResult;
  signals: Signal[];
  today: Today;
  futures: FutureResult;
  ironLow: boolean;
}

const cache = new WeakMap<Profile, Map<string, Derived>>();

export function derive(profile: Profile, levers: Levers): Derived {
  const key = JSON.stringify(levers);
  let m = cache.get(profile);
  if (!m) cache.set(profile, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const ferr = profile.labs.find((l) => l.key === "ferritin");
  const ironLow = !!ferr && ferr.points[ferr.points.length - 1].value < 30;
  const d: Derived = {
    profile,
    clock: computeClock(profile),
    signals: computeSignals(profile),
    today: cycleToday(profile),
    futures: simulate(profile.age, levers, ironLow),
    ironLow,
  };
  m.set(key, d);
  return d;
}

/** Everything the UI needs, recomputed only when the profile or levers change. */
export function useDerived(): Derived {
  const profile = useStore((s) => s.profile);
  const levers = useStore((s) => s.levers);
  return useMemo(() => derive(profile, levers), [profile, levers]);
}
