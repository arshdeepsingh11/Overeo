/* Request checks shared by the agent routes (no extra library). */
import { teamById, type TeamId } from "@/agents/team";

export const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function cleanFacts(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((f): f is string => typeof f === "string").slice(0, 45).map((f) => f.slice(0, 300)) : [];
}

export function cleanMessages(x: unknown): { role: "user" | "assistant"; content: string }[] | null {
  if (!Array.isArray(x) || !x.length || x.length > 20) return null;
  const out = x
    .filter((m): m is { role: string; content: string } => !!m && typeof m === "object" && typeof (m as { content?: unknown }).content === "string")
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  return out.length && out[out.length - 1].role === "user" ? out.slice(-8) : null;
}

export function cleanAgent(x: unknown): TeamId | null {
  const a = typeof x === "string" ? teamById(x) : undefined;
  return a && !a.networkOnly && !a.tool ? a.id : null;
}
