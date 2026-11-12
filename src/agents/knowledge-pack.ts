import { corpus } from "./corpus";
import { SHARED_LIMITS, SITE_MAP, TEAM } from "./team";

/* =====================================================================
   OVEREO's knowledge pack — everything the agents know, in one
   Markdown file, for loading into Xevyo's knowledge base (or any
   reviewer). Built from the same passages the agents answer from, so
   the two can never drift apart. Contains no user data and no prices.
   ===================================================================== */

export function knowledgePack(): string {
  const out: string[] = [];
  out.push("# OVEREO knowledge pack", "", "Women's precision health · BioAro ecosystem. Educational — never a diagnosis.", "");
  out.push("## Rules every agent follows", ...SHARED_LIMITS.map((x) => `- ${x}`), "");
  out.push("## The team");
  for (const a of TEAM) {
    out.push(`### ${a.name} — ${a.title}`, a.role, "", `Does: ${a.does.join("; ")}.`, `Does not: ${a.doesNot.join("; ")}.`, "", "Briefing:", a.briefing, "");
  }
  out.push("## Pages agents may link to", ...SITE_MAP.map((x) => `- ${x.label}: ${x.route}`), "");
  out.push("## Knowledge passages");
  const groups = new Map<string, { text: string; href?: string }[]>();
  for (const p of corpus()) {
    const g = groups.get(p.source) ?? [];
    g.push({ text: p.text, href: p.href });
    groups.set(p.source, g);
  }
  for (const [src, items] of groups) {
    out.push(`### ${src}`);
    const href = items.find((x) => x.href)?.href;
    if (href) out.push(`Link: ${href}`);
    for (const i of items) out.push(`- ${i.text}`);
    out.push("");
  }
  return out.join("\n");
}
