import { closeSI, toast } from "../../core/store";
import { navigate } from "../../core/routes";
import { orderTest } from "../../integrations/shopify";
import { addRecord, diary, tellMemory } from "../space";
import type { MeasurementType, ValueMap } from "../types";
import type { MindAction } from "./answer";

/* Carry out an action Mind offered — only ever after she taps it. */

export async function runMindAction(a: MindAction, ask: (q: string) => void): Promise<string | null> {
  switch (a.kind) {
    case "href":
      closeSI();
      navigate(a.href);
      return null;
    case "ask":
      ask(a.ask);
      return null;
    case "log": {
      const at = new Date();
      if (a.log.when === "yesterday") at.setDate(at.getDate() - 1);
      // period dates are about the day, not the minute
      if (a.log.type === "period_start" || a.log.type === "period_end") at.setHours(a.log.type === "period_start" ? 8 : 20, 0, 0, 0);
      addRecord(a.log.type as MeasurementType, a.log.value as unknown as ValueMap[MeasurementType], { observedAt: at.toISOString() });
      diary("si", "Logged what you told SI", a.log.label);
      toast(`Logged · ${a.log.label}`);
      return "Logged";
    }
    case "remember":
      tellMemory(a.text);
      toast("Remembered");
      return "Remembered";
    case "order": {
      const r = await orderTest(a.handle);
      diary("si", r.ok ? "Opened a test to order" : "Tried to open checkout", a.test);
      toast(r.message);
      return r.ok ? "Opened" : null;
    }
  }
}
