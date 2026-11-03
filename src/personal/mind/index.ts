import { useMemo } from "react";
import { space, useSpace, type SpaceState } from "../space";
import { buildModel, type MindModel } from "./model";
import { understand, type Understanding } from "./nlu";
import { answer, type MindAnswer } from "./answer";
import { dayKey } from "./stats";

/* =====================================================================
   OVEREO Mind — one entry point.

     model()   her personal model (cached until her data or the day changes)
     think(q)  understand a question and answer it from her data
     useMind() the model, reactive, for screens

   Runs entirely on her device in a few milliseconds. The live brain
   (Xevyo) is optional and only ever sees the facts Mind chooses to share.
   ===================================================================== */

let cache: { key: unknown[]; m: MindModel } | null = null;

function keyOf(s: SpaceState) {
  // topics change with every question; they don't change her model, so they aren't part of the key
  return [s.ns, s.records, s.account, s.feedback, s.overrides, s.told, dayKey(new Date())];
}

export function model(s: SpaceState = space.get()): MindModel {
  const key = keyOf(s);
  if (cache && cache.key.length === key.length && cache.key.every((k, i) => k === key[i])) return cache.m;
  const m = buildModel(s, new Date(), s.mind.topics);
  cache = { key, m };
  return m;
}

export function think(q: string, s: SpaceState = space.get()): { u: Understanding; a: MindAnswer | null; m: MindModel } {
  const m = model(s);
  const own = m.symptoms.map((x) => x.name);
  const u = understand(q, own);
  const a = answer(u, m, s);
  return { u, a, m };
}

export function useMind(): MindModel {
  const records = useSpace((s) => s.records);
  const account = useSpace((s) => s.account);
  const feedback = useSpace((s) => s.feedback);
  const overrides = useSpace((s) => s.overrides);
  const told = useSpace((s) => s.told);
  const ns = useSpace((s) => s.ns);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => model(space.get()), [records, account, feedback, overrides, told, ns]);
}

export type { MindModel, MindAnswer, Understanding };
export { factsFor } from "./answer";
