import type { Command } from "../core/bus";
import type { IconName } from "../ui/Icon";

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
