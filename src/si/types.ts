import type { Command } from "../core/bus";
import type { IconName } from "../ui/Icon";
import type { MindAction } from "../personal/mind/answer";
import type { Evidence } from "../personal/mind/model";

export interface SIAction {
  label: string;
  icon?: IconName;
  cmds: Command[];
}

export type SIViz = "clock" | "signals" | "forecast" | "futures" | "labs" | "ecosystem";

export interface SIAnswer {
  title: string;
  summary: string;
  points?: string[];
  used: string[];
  missing?: string[];
  limits?: string;
  questions?: string[];
  actions?: SIAction[];
  tone?: "info" | "signal" | "alert" | "good";
  viz?: SIViz;
  sources?: { label: string; url: string }[];
  /** steps shown while SI "works" before streaming */
  trace?: string[];
  /** a side effect to run immediately (commands like "dark mode") */
  effects?: Command[];
  /** where the answer came from */
  source?: "mind" | "xevyo" | "engine";
  /** OVEREO Mind: what it understood, how sure, and why (her own data) */
  intent?: string;
  confidence?: number;
  why?: Evidence[];
  mindActions?: MindAction[];
  followUps?: string[];
  outcome?: { label: string; unit: string; now: number; then: number; low: number; high: number; min: number; max: number };
  /** the facts the live brain was given */
  sharedFacts?: string[];
  /** the question, for "explain more" */
  question?: string;
}

export interface SIContext {
  section: string;
  useProfile: boolean;
  useSignals: boolean;
}

export interface SIMessage {
  id: string;
  role: "user" | "si";
  text: string;
  answer?: SIAnswer;
  status?: "thinking" | "streaming" | "done";
  remote?: boolean;
}
