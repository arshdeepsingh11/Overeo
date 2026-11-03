import type { SpaceState } from "../space";
import { GOAL_LABEL } from "../patterns";
import { PHASE_META } from "../../core/engines/forecast";
import type { Evidence, MindModel } from "./model";
import type { IntentId, LogIntent, Understanding } from "./nlu";
import { LAB_INFO, PHASE_PLAIN, SYMPTOM_INFO } from "./knowledge";
import { whatIf } from "./whatif";
import { addDays, dayDiff, r1, sureLabel } from "./stats";

/* =====================================================================
   OVEREO Mind — answers from her own data.

   Every answer is assembled from her model: it says what it found, how
   sure it is, and exactly what it used ("Why this?"). When a question is
   outside what her data can answer, `personal` is false and the caller
   may ask the live brain — sending only the facts listed in `facts`.
   ===================================================================== */

export type MindAction =
  | { kind: "href"; label: string; href: string }
  | { kind: "ask"; label: string; ask: string }
  | { kind: "log"; label: string; log: LogIntent }
  | { kind: "remember"; label: string; text: string }
  | { kind: "order"; label: string; handle: string; test: string };

export interface MindAnswer {
  intent: IntentId;
  /** how sure the understanding + the answer are, 0–1 */
  confidence: number;
  title: string;
  text: string;
  points?: string[];
  evidence: Evidence[];
  actions?: MindAction[];
  followUps?: string[];
  tone?: "info" | "signal" | "alert" | "good";
  /** answered from her data (true) or needs general knowledge (false) */
  personal: boolean;
  /** a richer explanation from the live brain would add value */
  deepen: boolean;
  /** the grounded facts behind this answer, in plain words */
  facts: string[];
  /** for the what-if slider */
  outcome?: { label: string; unit: string; now: number; then: number; low: number; high: number; min: number; max: number };
}

const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtS = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function answer(u: Understanding, m: MindModel, s: SpaceState): MindAnswer | null {
  const base = (a: Omit<MindAnswer, "intent" | "facts" | "personal" | "deepen" | "confidence"> & Partial<Pick<MindAnswer, "personal" | "deepen" | "confidence">>): MindAnswer => ({
    intent: u.intent,
    confidence: a.confidence ?? u.confidence,
    personal: a.personal ?? true,
    deepen: a.deepen ?? false,
    facts: factsFor(m, u),
    ...a,
  });
  const c = m.learned.cycle;
  const p = c.pred;
  const logAction: MindAction[] = u.log ? [{ kind: "log", label: `Log it: ${u.log.label}`, log: u.log }] : [];

  switch (u.intent) {
    case "emergency":
      return base({ ...emergencyAnswer(u.emergency!), tone: "alert", personal: true, confidence: 1 });

    case "log": {
      const lg = u.log!;
      if (lg.type === "period_start" && c.starts.length) {
        const last = c.starts[c.starts.length - 1];
        const gap = dayDiff(lg.when === "yesterday" ? addDays(m.now, -1) : m.now, last);
        if (gap >= 0 && gap <= 10)
          return base({
            title: "Your period is already logged",
            text: `You logged a period starting ${fmt(last)} — ${gap === 0 ? "today" : `${gap} day${gap === 1 ? "" : "s"} ago`}. If this is the same period, there's nothing new to log. If it really is a new one, you can still add it.`,
            evidence: [{ label: "Last period start", detail: fmt(last) }],
            actions: [{ kind: "log", label: "It's a new period — log it", log: lg }, { kind: "log", label: "Log that it ended", log: { type: "period_end", value: {}, when: lg.when, label: `Period ended ${lg.when}` } }],
          });
      }
      return base({
        title: "Want me to log that?",
        text: `${lg.label}${lg.when === "yesterday" ? " (yesterday)" : ""}. Tap to save it — it's how I learn your patterns.`,
        evidence: [{ label: "What you told me", detail: u.text }],
        actions: [{ kind: "log", label: "Log it", log: lg }, { kind: "href", label: "Open tracker", href: `/app/track?t=${lg.type}` }],
        tone: "good",
      });
    }

    case "remember":
      return base({
        title: "Shall I remember this?",
        text: `"${u.memory}". I'll use it in every answer, and you can change or delete it any time in Me → What OVEREO knows.`,
        evidence: [{ label: "What you told me", detail: u.memory! }],
        actions: [{ kind: "remember", label: "Yes, remember it", text: u.memory! }],
        tone: "good",
      });

    case "forget":
      return base({ title: "You decide what I keep", text: "Open What OVEREO knows about you — each item has Correct and Forget.", evidence: [], actions: [{ kind: "href", label: "What OVEREO knows", href: "/app/me" }] });

    case "greet":
      return base({ title: `Hi ${m.name}`, text: m.insights[0] ? `${m.insights[0].title}. ${m.insights[0].text}` : "Ask me about your cycle, symptoms, sleep, labs — or tell me how you feel and I'll log it.", evidence: m.insights[0]?.evidence ?? [], followUps: ["How am I doing?", "When is my next period?", "What have you learned about me?"] });

    case "thanks":
      return base({ title: "Any time", text: "I'm here whenever you want to check in.", evidence: [] });

    case "help":
      return base({
        title: "What I can do",
        text: "I answer from your own data, on your device, and show you why.",
        points: ["Predict your period, ovulation and fertile window", "Explain your symptoms, mood, sleep and lab results", "Spot what's unusual for you, and what usually comes next", "Run what-ifs (\"what if I sleep an hour more?\")", "Log things you tell me (\"bad cramps today\") — you confirm", "Prepare a summary for your doctor"],
        evidence: [],
        followUps: ["How am I doing?", "Prepare for my doctor visit", "What if I sleep 1 hour more?"],
      });

    case "period_next": {
      if (!c.starts.length)
        return base({ title: "I need one date to start", text: "When did your last period start? That single date lets me predict the next one, and it gets sharper with every cycle you log.", evidence: [], actions: [{ kind: "href", label: "Add a period date", href: "/app/track?t=period_start" }, ...logAction] });
      const last = c.starts[c.starts.length - 1];
      const late = c.daysUntil != null && p.late && dayDiff(m.now, p.late) > 0;
      const text = late
        ? `It's later than expected — I estimated ${fmt(c.nextStart!)}, and your usual range ended ${fmtS(p.late!)}. Stress, illness, travel, weight change or pregnancy can delay a period. If it has started, log it.`
        : c.daysUntil != null && c.daysUntil < 0
          ? `It's due now — I estimated ${fmt(c.nextStart!)}, and your usual range runs to ${fmtS(p.late!)}.`
          : `Most likely ${fmt(c.nextStart!)} — ${c.daysUntil === 0 ? "today" : `in ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}`}, usually between ${fmtS(p.early!)} and ${fmtS(p.late!)}.`;
      return base({
        title: late ? "Your period is late" : "Your next period",
        text,
        points: [`Based on ${p.basis}${c.lengths.length ? ` (${c.lengths.slice(-6).join(", ")} days)` : ""}.`, `I'm ${sureLabel(p.confidence)}${c.needed ? ` — ${c.needed} more cycle${c.needed === 1 ? "" : "s"} will make this fully yours` : ""}.`],
        evidence: [{ label: "Last period started", detail: fmt(last) }, { label: "Cycle length used", detail: `${p.length} days ±${p.spread}` }, { label: "Your cycles", detail: c.lengths.slice(-6).join(", ") + (c.lengths.length ? " days" : "—") }],
        actions: [{ kind: "href", label: "Log period", href: "/app/track?t=period_start" }, ...(late ? [{ kind: "ask" as const, label: "Could I be pregnant?", ask: "Could I be pregnant?" }] : [])],
        confidence: Math.min(u.confidence, p.confidence + 0.15),
      });
    }

    case "cycle_phase": {
      if (!c.day || !c.phase) return base({ title: "Let's find your cycle day", text: "Log when your last period started and I'll show your cycle day and phase.", evidence: [], actions: [{ kind: "href", label: "Add a period date", href: "/app/track?t=period_start" }] });
      const ph = c.phase;
      const feel: string[] = [];
      const mp = m.phase.mood;
      const sp = m.phase.sleep;
      if (c.daysUntil != null && c.daysUntil <= 5 && c.daysUntil >= 0) {
        if (mp?.pre != null && mp.mid != null && mp.mid - mp.pre >= 0.4) feel.push(`Your mood in these days usually averages ${mp.pre}/5 (vs ${mp.mid}/5 mid-cycle).`);
        if (sp?.pre != null && sp.mid != null && sp.mid - sp.pre >= 0.3) feel.push(`You usually sleep ${sp.pre} h now (vs ${sp.mid} h mid-cycle).`);
      }
      if (ph === "menstrual") {
        const sym = m.symptoms.find((x) => x.inPeriod >= 0.5 && x.cycles >= 2);
        if (sym) feel.push(`${sym.name} usually shows up now for you (about ${sym.avgSeverity}/10).`);
      }
      return base({
        title: `Day ${c.day} · ${PHASE_META[ph].label}`,
        text: `You're on day ${c.day} of your cycle, in ${PHASE_PLAIN[ph]}.${c.daysUntil != null && c.daysUntil >= 0 ? ` Your next period is likely in ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}.` : ""}`,
        points: feel.length ? feel : undefined,
        evidence: [{ label: "Last period started", detail: fmt(c.starts[c.starts.length - 1]) }, { label: "Cycle length used", detail: `${p.length} days` }],
      });
    }

    case "cycle_regular": {
      if (c.lengths.length < 3) return base({ title: "A few more cycles needed", text: `I have ${c.lengths.length} complete cycle${c.lengths.length === 1 ? "" : "s"} so far. With three or more I can tell you how regular you are.`, evidence: [{ label: "Your cycles", detail: c.lengths.join(", ") || "—" }] });
      const label = p.regularity === "regular" ? "regular" : p.regularity === "variable" ? "a little variable" : "irregular";
      return base({
        title: `Your cycles are ${label}`,
        text: `Your last ${Math.min(6, c.lengths.length)} cycles were ${c.lengths.slice(-6).join(", ")} days — ${p.range} days between the shortest and longest.${p.outside.length ? ` ${p.outside.length} fell outside the usual 24–38 days.` : " All are within the usual 24–38 days."}`,
        points: [
          "Normal: a period every 24–38 days, varying by no more than 7–9 days (FIGO 2018).",
          ...(p.periodDays ? [`Your bleeding lasts about ${p.periodDays} days (normal is up to 8).`] : []),
          ...(p.regularity === "irregular" || p.outside.length ? ["Worth mentioning to a clinician — I can prepare a summary with your dates."] : []),
        ],
        evidence: [{ label: "Your cycle lengths", detail: c.lengths.slice(-6).join(", ") + " days" }, { label: "FIGO 2018", detail: "Normal frequency and regularity" }],
        actions: p.regularity === "irregular" || p.outside.length ? [{ kind: "href", label: "Prepare a visit summary", href: "/app/visit" }] : undefined,
      });
    }

    case "fertile": {
      if (m.stage === "pregnant" || m.stage === "post" || m.stage === "postpartum")
        return base({ title: "Not for your stage right now", text: "Fertile-window estimates are for cycling. If your situation changed, update your life stage in Me.", evidence: [], actions: [{ kind: "href", label: "Open Me", href: "/app/me" }] });
      if (!p.ovulation || !p.fertile)
        return base({ title: p.regularity === "irregular" ? "Hard to estimate with irregular cycles" : "I need your cycle first", text: p.regularity === "irregular" ? "Your cycle lengths vary a lot, so a calendar estimate would be unreliable. Ovulation (LH) tests or waking temperature give a much better picture." : "Log your last period start and I'll estimate ovulation and your fertile window.", evidence: [{ label: "Your cycles", detail: c.lengths.slice(-6).join(", ") || "—" }] });
      return base({
        title: "Your fertile window",
        text: `Estimated ${fmt(p.fertile.from)} to ${fmt(p.fertile.to)}, with ovulation around ${fmt(p.ovulation)}.`,
        points: [
          "The fertile days are the five before ovulation and the day of it (Wilcox et al., 1995).",
          `This is a calendar estimate from ${p.basis}; ovulation tests or waking temperature make it sharper.`,
          ...(m.learned.memory.some((x) => x.id === "temp-shift") ? ["Your waking temperature already shows a clear rise after ovulation — logging it daily confirms when it happened."] : []),
          "Not a method of contraception.",
        ],
        evidence: [{ label: "Next period estimate", detail: fmt(c.nextStart!) }, { label: "Cycle length used", detail: `${p.length} days ±${p.spread}` }],
        confidence: Math.min(u.confidence, p.confidence),
      });
    }

    case "pregnant": {
      const late = c.daysUntil != null && c.daysUntil < 0;
      return base({
        title: "I can't tell from your data — a test can",
        text: late
          ? `Your period is ${-c.daysUntil!} day${c.daysUntil === -1 ? "" : "s"} past my estimate (${fmt(c.nextStart!)}). A home pregnancy test is most reliable from the first day of a missed period; if it's negative and your period still hasn't come, test again in a few days.`
          : "A home pregnancy test is most reliable from the first day of a missed period.",
        points: ["Get care urgently for severe one-sided pain, shoulder-tip pain, fainting or heavy bleeding — especially if you might be pregnant."],
        evidence: c.nextStart ? [{ label: "Expected period", detail: fmt(c.nextStart) }] : [],
        actions: [{ kind: "href", label: "Log period", href: "/app/track?t=period_start" }],
        deepen: true,
      });
    }

    case "symptom": {
      const name = u.symptom ?? m.symptoms[0]?.name ?? null;
      const info = name ? (SYMPTOM_INFO[name] ?? SYMPTOM_INFO[Object.keys(SYMPTOM_INFO).find((k) => k.toLowerCase().includes(name.toLowerCase().split(" ")[0])) ?? ""]) : undefined;
      const st = name ? m.symptoms.find((x) => x.name === name || x.name.toLowerCase().includes(name.toLowerCase().split(" ")[0]) || name.toLowerCase().includes(x.name.toLowerCase().split(" ")[0])) : undefined;
      if (!name) return null;
      const pts: string[] = [];
      if (st) {
        const timing = st.inPeriod >= 0.5 ? "mostly in the first days of your period" : st.beforePeriod >= 0.4 ? "mostly in the days before your period" : "at different points in your cycle";
        pts.push(`You've logged it ${st.entries} time${st.entries === 1 ? "" : "s"} over ${st.cycles} cycle${st.cycles === 1 ? "" : "s"}, ${timing}, averaging ${st.avgSeverity}/10.`);
        if (st.change != null && Math.abs(st.change) >= 1) pts.push(`It's been ${st.change > 0 ? "stronger" : "milder"} in your last two cycles (${st.change > 0 ? "+" : ""}${st.change} points).`);
        const link = m.links.find((l) => l.id === "sleep->pain");
        if (link && /pain|cramp/i.test(name)) pts.push(link.text);
      }
      if (info) pts.push(...info.helps.map((h) => `Can help: ${h}`));
      return base({
        title: st ? `Your ${name.toLowerCase()}` : name,
        text: `${info?.about ?? ""}${st ? "" : " You haven't logged it yet — logging it with the day helps me find your pattern."}`.trim(),
        points: [...pts, ...(info ? [info.see] : [])],
        evidence: st ? [{ label: "Your symptom log", detail: `${st.entries} entries, last ${fmtS(st.lastAt)}` }, { label: "Cycles with it", detail: String(st.cycles) }] : [],
        actions: [...logAction, ...(st && st.cycles >= 3 ? [{ kind: "href" as const, label: "Prepare a visit summary", href: "/app/visit" }] : []), ...(!u.log ? [{ kind: "href" as const, label: "Log a symptom", href: "/app/track?t=symptom" }] : [])],
        deepen: !st,
        personal: !!st || !!info,
      });
    }

    case "mood": {
      const md = m.metrics.mood;
      if (md.n < 5) return base({ title: "Let's learn your mood", text: "A one-tap mood check-in each day is all I need. In two weeks I can show you how your mood moves with your cycle and sleep.", evidence: [{ label: "Mood check-ins", detail: String(md.n) }], actions: [...logAction, { kind: "href", label: "Check in now", href: "/app/track?t=mood" }], deepen: true });
      const pts: string[] = [];
      const mp = m.phase.mood;
      if (mp?.pre != null && mp.mid != null && mp.mid - mp.pre >= 0.4) pts.push(`Your mood tends to dip in the 5 days before your period (${mp.pre}/5 vs ${mp.mid}/5 mid-cycle).`);
      m.links.filter((l) => l.to === "mood").forEach((l) => pts.push(l.text));
      const low = m.insights.find((i) => i.id === "mood-low");
      const nowNear = c.daysUntil != null && c.daysUntil >= 0 && c.daysUntil <= 5;
      return base({
        title: low ? "Your mood has been lower lately" : "Your mood",
        text: md.recent && md.baseline ? `Lately about ${r1(md.recent.mean)}/5, versus your usual ${r1(md.baseline.mean)}/5.${nowNear && pts.length ? " You're in the days before your period, when this often happens for you." : ""}` : `Your average is ${r1(md.baseline?.mean ?? 3)}/5.`,
        points: [...pts, ...(low && /alone/.test(low.text) ? [low.text] : []), "Sleep, daylight, movement and talking to someone you trust all help."],
        evidence: [{ label: "Mood check-ins", detail: `${md.n}` }, ...(md.baseline ? [{ label: "Your normal", detail: `${r1(md.baseline.mean)}/5` }] : [])],
        actions: [...logAction, { kind: "ask", label: "What if I sleep more?", ask: "What if I sleep 1 hour more?" }],
      });
    }

    case "sleep": {
      const sl = m.metrics.sleep;
      if (sl.n < 5) return base({ title: "Let's learn your sleep", text: "Log how long you slept each morning — in two weeks I can show your patterns.", evidence: [{ label: "Nights logged", detail: String(sl.n) }], actions: [...logAction, { kind: "href", label: "Log sleep", href: "/app/track?t=sleep_duration" }], deepen: true });
      const pts: string[] = [];
      const sp = m.phase.sleep;
      if (sp?.pre != null && sp.mid != null && sp.mid - sp.pre >= 0.3) pts.push(`You sleep less before your period (${sp.pre} h vs ${sp.mid} h mid-cycle).`);
      m.links.filter((l) => l.from === "sleep").forEach((l) => pts.push(l.text));
      if (sl.trend) pts.push(`Trend: ${sl.trend.perWeek > 0 ? "up" : "down"} about ${Math.round(Math.abs(sl.trend.perWeek) * 60)} minutes a night per week.`);
      const usual = sl.baseline?.mean ?? sl.recent?.mean ?? 0;
      pts.push(usual < 7 ? "Adults do best with 7 hours or more (AASM/SRS)." : "You're meeting the 7-hour guideline on average (AASM/SRS).");
      return base({
        title: "Your sleep",
        text: sl.recent && sl.baseline ? `Lately ${r1(sl.recent.mean)} h a night; your usual is ${r1(sl.baseline.mean)} h.` : `About ${r1(usual)} h a night.`,
        points: pts,
        evidence: [{ label: "Nights logged", detail: String(sl.n) }, ...(sl.baseline ? [{ label: "Your normal", detail: `${r1(sl.baseline.mean)} h ±${r1(sl.baseline.sd)}` }] : [])],
        actions: [...logAction, { kind: "ask", label: "What if I sleep 1 hour more?", ask: "What if I sleep 1 hour more?" }],
      });
    }

    case "tired": {
      const reasons: { t: string; w: number }[] = [];
      const sl = m.metrics.sleep;
      const sleepNow = sl.recent?.mean ?? sl.baseline?.mean;
      if (sleepNow != null && sleepNow < 7) reasons.push({ t: `Sleep: ${r1(sleepNow)} h a night lately — under the 7 hours adults need.`, w: 7 - sleepNow + 1 });
      if (sl.recent && sl.baseline && sl.baseline.mean - sl.recent.mean >= 0.5) reasons.push({ t: `Less sleep than your usual (${r1(sl.recent.mean)} h vs ${r1(sl.baseline.mean)} h).`, w: 2 });
      const ferr = m.labs.find((l) => /ferritin/i.test(l.name));
      if (ferr && ferr.latest < 30) reasons.push({ t: `Iron stores: ferritin ${ferr.latest} ${ferr.unit}${ferr.change && ferr.change < -0.1 ? `, down from ${ferr.points[0].v}` : ""} — low iron commonly causes tiredness.`, w: 3 });
      const hb = m.labs.find((l) => /hemoglobin|haemoglobin/i.test(l.name));
      if (hb?.flag === "low") reasons.push({ t: `Haemoglobin ${hb.latest} ${hb.unit} is low (anaemia).`, w: 3.5 });
      const tsh = m.labs.find((l) => /tsh/i.test(l.name));
      if (tsh?.flag === "high") reasons.push({ t: `TSH ${tsh.latest} is high — an underactive thyroid can cause tiredness.`, w: 3 });
      const vd = m.labs.find((l) => /vitamin d/i.test(l.name));
      if (vd?.flag === "low") reasons.push({ t: `Vitamin D ${vd.latest} ${vd.unit} is low.`, w: 1 });
      if (c.phase === "menstrual" || (c.daysUntil != null && c.daysUntil >= 0 && c.daysUntil <= 3)) reasons.push({ t: "Timing: you're around your period, when energy often dips.", w: 1.2 });
      const md = m.metrics.mood;
      if (md.recent && md.baseline && md.baseline.mean - md.recent.mean >= 0.8) reasons.push({ t: "Mood has been lower than usual — low mood and tiredness often travel together.", w: 1.5 });
      reasons.sort((a, b) => b.w - a.w);
      const missing = [!ferr && "ferritin (iron stores)", !tsh && "TSH (thyroid)"].filter(Boolean) as string[];
      return base({
        title: reasons.length ? "What may be behind your tiredness" : "Let's find what's behind it",
        text: reasons.length ? `From your data, the most likely contributors, strongest first:` : "Nothing in your data stands out yet. Logging sleep and mood for a week, and checking iron and thyroid, usually finds the cause.",
        points: [...reasons.slice(0, 4).map((r) => r.t), ...(missing.length ? [`Not on file yet: ${missing.join(" and ")} — two common, easy-to-fix causes worth asking about.`] : []), "See a clinician if it lasts more than a few weeks, or comes with breathlessness, very heavy periods or weight change."],
        evidence: [...(sleepNow != null ? [{ label: "Sleep", detail: `${r1(sleepNow)} h recent` }] : []), ...(ferr ? [{ label: "Ferritin", detail: `${ferr.latest} ${ferr.unit} (${fmtS(ferr.at)})` }] : []), ...(c.day ? [{ label: "Cycle day", detail: String(c.day) }] : [])],
        actions: [{ kind: "ask", label: "Which tests would help?", ask: "Which tests should I take?" }, ...logAction],
      });
    }

    case "lab": {
      const name = u.lab;
      if (!name) return null;
      const info = LAB_INFO[name];
      const lab = m.labs.find((l) => l.name.toLowerCase() === name.toLowerCase()) ?? m.labs.find((l) => l.name.toLowerCase().startsWith(name.toLowerCase().split(" ")[0]));
      if (!lab)
        return base({
          title: name,
          text: `${info?.what ?? ""} ${info?.context ?? ""} You don't have a ${name} result on file yet.`.trim(),
          points: [...(info?.timing ? [info.timing] : [])],
          evidence: info ? [{ label: "Source", detail: info.source }] : [],
          actions: [{ kind: "href", label: "Add a result", href: "/app/track?t=lab_result" }, ...(info?.bioaro ? [{ kind: "order" as const, label: `Order ${name} test`, handle: info.bioaro, test: name }] : [])],
          personal: !!info,
          deepen: !info,
        });
      const flagTxt = lab.flag ? ` That's ${lab.flag} for the range on your report (${lab.low ?? "?"}–${lab.high ?? "?"}).` : lab.low != null || lab.high != null ? ` That's within the range on your report (${lab.low ?? "?"}–${lab.high ?? "?"}).` : "";
      const pts: string[] = [];
      if (lab.points.length > 1) pts.push(`Your results: ${lab.points.map((x) => `${x.v} (${fmtS(x.at)})`).join(" → ")}.`);
      if (info?.context) pts.push(info.context);
      if (info?.timing) {
        // read hormone values in the light of the cycle day they were drawn
        const cd = cycleDayOf(m, lab.at);
        pts.push(`${info.timing}${cd ? ` Yours was drawn on cycle day ${cd}.` : ""}`);
      }
      if (lab.flag && info?.retest) pts.push(info.retest);
      if (lab.daysSince > 365) pts.push(`This result is ${Math.round(lab.daysSince / 30)} months old.`);
      return base({
        title: `Your ${name}`,
        text: `${info?.what ?? ""} Yours is ${lab.latest} ${lab.unit} (${fmtS(lab.at)}).${flagTxt}`.trim(),
        points: pts,
        evidence: [{ label: "Your result", detail: `${lab.latest} ${lab.unit} on ${fmt(lab.at)}` }, ...(info ? [{ label: "Context from", detail: info.source }] : [])],
        actions: [...(info?.bioaro ? [{ kind: "order" as const, label: lab.flag ? `Order a retest` : `Order ${name} test`, handle: info.bioaro, test: name }] : []), { kind: "href", label: "Prepare a visit summary", href: "/app/visit" }],
        tone: lab.flag ? "signal" : "info",
        deepen: !info,
      });
    }

    case "labs_all":
    case "tests":
      if (u.intent === "tests") return testsAnswer(m, base);
      return base({
        title: "Your lab results",
        text: m.labs.length ? `${m.labs.length} test${m.labs.length === 1 ? "" : "s"} on file${m.labs.some((l) => l.flag) ? `; ${m.labs.filter((l) => l.flag).length} outside the range` : ", all within range"}.` : "No lab results yet. Snap a report or add one value.",
        points: m.labs.map((l) => `${l.name}: ${l.latest} ${l.unit}${l.flag ? ` (${l.flag})` : ""} · ${fmtS(l.at)}`),
        evidence: [{ label: "Results on file", detail: String(m.labs.length) }],
        actions: [{ kind: "href", label: "Add a report", href: "/app/track?t=lab_result" }],
      });

    case "safety":
      return base({
        title: "Emergency signs — act fast",
        text: "If any of these are happening now, call your local emergency number (911 in Canada and the US).",
        points: [
          "Stroke — BE FAST: Balance loss, Eyes (sudden vision loss), Face drooping, Arm weakness, Speech difficulty → Time to call.",
          "Heart attack: chest pain or pressure, pain spreading to arm, jaw or back, breathlessness, cold sweat, nausea — women more often have the non-chest signs.",
          "Very heavy bleeding (a pad or tampon every hour for several hours), fainting, or severe sudden pain — especially if you might be pregnant.",
        ],
        evidence: [{ label: "American Heart Association / American Stroke Association" }],
        tone: "alert",
      });

    case "bp": {
      if (/\b(lower|reduce|bring down|improve|decrease|get down)\b/.test(u.text)) {
        const w = whatIf(m, "bp", null, u.text);
        return base({ title: w.title, text: w.text, points: w.points, evidence: w.evidence });
      }
      if (!m.bp && !m.metrics.sys.last) return base({ title: "No blood pressure yet", text: "Log a reading (seated, after 5 minutes of rest) and I'll keep track of where you stand.", evidence: [], actions: [...logAction, { kind: "href", label: "Log blood pressure", href: "/app/track?t=blood_pressure" }] });
      const last = m.metrics.sys.last!;
      const dia = m.metrics.dia.last!;
      return base({
        title: "Your blood pressure",
        text: m.bp ? `Your 30-day average is ${m.bp.sys}/${m.bp.dia} — ${m.bp.category === "normal" ? "in the normal range" : `in the "${m.bp.category}" range`} (ACC/AHA 2017). Last reading ${last.v}/${dia.v} on ${fmtS(last.at)}.` : `Your last reading was ${last.v}/${dia.v} on ${fmtS(last.at)}.`,
        points: ["Normal is under 120/80; 130/80 or higher is high blood pressure (ACC/AHA 2017).", "Measure seated, back supported, arm at heart level, after 5 minutes' rest — and take two readings."],
        evidence: [{ label: "Readings (30 days)", detail: String(m.bp?.n ?? 0) }, { label: "ACC/AHA 2017", detail: "Blood pressure categories" }],
        actions: [...logAction, { kind: "href", label: "Log a reading", href: "/app/track?t=blood_pressure" }],
        tone: m.bp && m.bp.category !== "normal" && m.bp.category !== "elevated" ? "signal" : "info",
      });
    }

    case "temp": {
      const t = m.metrics.temp;
      const shift = m.learned.memory.find((x) => x.id === "temp-shift");
      if (!t.n) return base({ title: "Waking temperature", text: "Measured each morning before getting up, it shows a small rise after ovulation — a way to confirm you ovulated.", evidence: [], actions: [...logAction, { kind: "href", label: "Log temperature", href: "/app/track?t=morning_temperature" }] });
      return base({
        title: "Your waking temperature",
        text: `Last ${r1(t.last!.v)} °C on ${fmtS(t.last!.at)}.${shift ? ` ${shift.text}` : " I don't see a clear rise after ovulation yet — daily readings help."}`,
        points: t.last!.v >= 38 ? ["That's a fever (38 °C or higher)."] : undefined,
        evidence: [{ label: "Readings", detail: String(t.n) }],
        actions: logAction,
      });
    }

    case "weight": {
      const w = m.metrics.weight;
      if (!w.n) return base({ title: "Weight is optional", text: "If you'd like, log it now and then; I'll only show changes, never judge.", evidence: [], actions: [...logAction, { kind: "href", label: "Log weight", href: "/app/track?t=weight" }] });
      const first90 = w.series.find((x) => dayDiff(m.now, x.at) <= 90);
      return base({
        title: "Your weight",
        text: `Last ${r1(w.last!.v)} kg on ${fmtS(w.last!.at)}${first90 && first90 !== w.last ? `, ${w.last!.v - first90.v >= 0 ? "up" : "down"} ${r1(Math.abs(w.last!.v - first90.v))} kg over the last 3 months` : ""}.`,
        evidence: [{ label: "Entries", detail: String(w.n) }],
        actions: logAction,
      });
    }

    case "meds": {
      if (!m.meds.length) return base({ title: "Your medicines", text: "Log what you take and I can remind you at the time you usually check in. I never suggest doses — that stays with your prescriber.", evidence: [], actions: [{ kind: "href", label: "Log a medicine", href: "/app/track?t=medication" }] });
      return base({
        title: "Your medicines",
        text: m.meds.map((x) => `${x.name}: taken on ${x.days14} of the last 14 days`).join(". ") + ".",
        points: ["I never suggest doses or changes — ask your prescriber or pharmacist."],
        evidence: m.meds.map((x) => ({ label: x.name, detail: `last logged ${fmtS(x.lastAt)}` })),
        actions: [{ kind: "href", label: "Log a dose taken", href: "/app/track?t=medication" }],
      });
    }

    case "whatif": {
      const w = whatIf(m, u.metric, u.delta, u.text);
      return base({ title: w.title, text: w.text, points: w.points, evidence: w.evidence, confidence: w.ok ? Math.min(u.confidence, w.confidence + 0.2) : 0.3, outcome: w.outcome, personal: w.ok, deepen: !w.ok });
    }

    case "overview": {
      const wk = m.learned.week;
      const top = m.insights.slice(0, 3);
      return base({
        title: "How you're doing",
        text: `This week: ${wk.daysLogged} of 7 days logged${wk.moodAvg != null ? `, mood ${wk.moodAvg}/5${wk.moodPrev != null ? ` (last week ${wk.moodPrev})` : ""}` : ""}${wk.sleepAvg != null ? `, sleep ${wk.sleepAvg} h` : ""}.${c.day ? ` Cycle day ${c.day}${c.daysUntil != null && c.daysUntil >= 0 ? `, period in about ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}` : ""}.` : ""}`,
        points: top.map((i) => `${i.title} — ${i.text}`),
        evidence: [{ label: "This week", detail: `${wk.entries} entries` }, ...top.flatMap((i) => i.evidence.slice(0, 1))],
        actions: [{ kind: "href", label: "Your week", href: "/app/recap" }],
      });
    }

    case "learned": {
      const mem = m.learned.memory;
      return base({
        title: "What I've learned about you",
        text: mem.length ? `${mem.length} thing${mem.length === 1 ? "" : "s"}, each from your own data — you can correct or delete any of them.` : "Nothing certain yet — patterns appear after about two weeks of check-ins. I only say what your data shows.",
        points: mem.slice(0, 7).map((x) => `${x.text} (${x.evidence.toLowerCase()})`),
        evidence: [{ label: "Records used", detail: String(m.engagement.total) }],
        actions: [{ kind: "href", label: "Correct or forget", href: "/app/me" }],
      });
    }

    case "visit":
      return base({
        title: "Your visit summary",
        text: "I've put your cycle, symptoms, mood and sleep, labs, medicines and the questions worth asking on one page you can print or save as a PDF.",
        points: [m.symptoms[0] ? `Top symptom: ${m.symptoms[0].name} (${m.symptoms[0].entries} entries)` : "No symptoms logged yet", m.labs.some((l) => l.flag) ? `Flagged labs: ${m.labs.filter((l) => l.flag).map((l) => l.name).join(", ")}` : "No flagged labs"],
        evidence: [{ label: "Records used", detail: String(m.engagement.total) }],
        actions: [{ kind: "href", label: "Open visit summary", href: "/app/visit" }],
      });

    default:
      return null;
  }
}

/* ------------------------------ helpers ------------------------------ */

function cycleDayOf(m: MindModel, d: Date) {
  const st = [...m.learned.cycle.starts].reverse().find((s) => s <= d);
  if (!st) return null;
  const cd = dayDiff(d, st) + 1;
  return cd <= 60 ? cd : null;
}

function testsAnswer(m: MindModel, base: (a: Omit<MindAnswer, "intent" | "facts" | "personal" | "deepen" | "confidence"> & Partial<Pick<MindAnswer, "personal" | "deepen" | "confidence">>) => MindAnswer): MindAnswer {
  const has = (n: RegExp) => m.labs.find((l) => n.test(l.name));
  const recs: { test: string; why: string; handle?: string }[] = [];
  const tired = m.symptoms.some((x) => /fatigue/i.test(x.name)) || (m.metrics.mood.baseline?.mean ?? 5) < 3;
  const heavy = m.symptoms.some((x) => /cramp|pelvic/i.test(x.name) && x.avgSeverity >= 6);
  const ferr = has(/ferritin/i);
  // a flagged result coming up for its usual ~3-month recheck
  for (const l of m.labs.filter((x) => x.flag && x.daysSince >= 60 && x.daysSince < 80))
    recs.push({ test: `${l.name} (recheck soon)`, why: `Your last was ${l.flag} (${l.latest} ${l.unit}); a recheck is usually around 3 months — in about ${Math.max(1, Math.round((90 - l.daysSince) / 7))} weeks.`, handle: LAB_INFO[l.name]?.bioaro });
  if (!ferr && (tired || heavy)) recs.push({ test: "Ferritin", why: "Low iron is common with heavy or painful periods and causes tiredness." });
  else if (ferr?.flag === "low" && ferr.daysSince >= 80) recs.push({ test: "Ferritin (retest)", why: `Your last was low (${ferr.latest} ${ferr.unit}) ${Math.round(ferr.daysSince / 30)} months ago.` });
  const vd = has(/vitamin d/i);
  if (!vd || (vd.flag === "low" && vd.daysSince >= 80)) recs.push({ test: "Vitamin D", why: vd ? `Your last was low (${vd.latest} ${vd.unit}).` : "A common, easily corrected deficiency.", handle: LAB_INFO["Vitamin D"].bioaro });
  if (!has(/tsh/i) && tired) recs.push({ test: "TSH (thyroid)", why: "Thyroid is a common, treatable cause of tiredness and cycle changes." });
  if (m.goals.some((g) => g === "fertility" || g === "egg-freezing") && !has(/amh/i)) recs.push({ test: "AMH", why: "Estimates egg reserve to plan egg freezing; can be drawn on any day." });
  if (m.goals.includes("pregnancy") && !has(/progesterone/i)) recs.push({ test: "Progesterone (7 days before your period)", why: "Confirms ovulation.", handle: LAB_INFO.Progesterone.bioaro });
  const irregular = m.learned.cycle.pred.regularity === "irregular" || m.learned.cycle.pred.outside.length > 0;
  if (irregular && !has(/testosterone/i)) recs.push({ test: "Total testosterone", why: "Irregular cycles — androgens are one of the checks for PCOS.", handle: LAB_INFO["Total testosterone"].bioaro });
  return base({
    title: recs.length ? "Tests that could help you" : "Nothing urgent to test",
    text: recs.length ? "Chosen from your own data and goals — scientifically useful, not a sales list. Your clinician can order any of them." : "Based on your data and goals, no test stands out right now.",
    points: recs.map((r) => `${r.test} — ${r.why}`),
    evidence: [{ label: "Your goals", detail: m.goals.map((g) => GOAL_LABEL[g] ?? g).join(", ") || "—" }, { label: "Labs on file", detail: m.labs.map((l) => l.name).join(", ") || "none" }],
    actions: recs.filter((r) => r.handle).map((r) => ({ kind: "order" as const, label: `Order ${r.test.replace(/ \(.+\)$/, "")}`, handle: r.handle!, test: r.test })),
  });
}

function emergencyAnswer(e: NonNullable<Understanding["emergency"]>): Pick<MindAnswer, "title" | "text" | "points" | "evidence" | "actions"> {
  const call = "Call your local emergency number now (911 in Canada and the US).";
  switch (e) {
    case "self-harm":
      return {
        title: "I'm really glad you told me",
        text: "You don't have to go through this alone. If you might act on these thoughts or are in danger, call your local emergency number now. In Canada and the US you can call or text 988 to reach a suicide crisis line, any time.",
        points: ["If you can, tell someone near you how you're feeling right now.", "Outside North America, your local emergency number or a local crisis line can help."],
        evidence: [{ label: "What you told me" }],
        actions: [],
      };
    case "heart":
      return { title: "This needs care now", text: `${call} Chest pain, pressure or pain spreading to the arm, jaw or back can be a heart attack. Don't drive yourself.`, points: ["Women often also feel breathlessness, nausea, sweating or unusual tiredness."], evidence: [{ label: "What you told me" }] };
    case "breathing":
      return { title: "This needs care now", text: `${call} Trouble breathing needs urgent help.`, evidence: [{ label: "What you told me" }] };
    case "stroke":
      return { title: "This could be a stroke — act now", text: `${call} Face drooping, arm weakness, speech trouble — every minute matters. Note the time it started.`, evidence: [{ label: "What you told me" }] };
    case "bleeding":
      return { title: "Very heavy bleeding needs care now", text: `Soaking a pad or tampon every hour for several hours, or feeling faint, needs urgent care. ${call}`, evidence: [{ label: "What you told me" }] };
    case "faint":
      return { title: "Fainting needs checking", text: `If you fainted and are pregnant, bleeding heavily, have chest pain or it happened during exercise — ${call} Otherwise, sit or lie down, drink water, and see a clinician today.`, evidence: [{ label: "What you told me" }] };
    case "pregnancy-pain":
      return { title: "Get care now", text: `Severe pain or bleeding in pregnancy can be serious (including ectopic pregnancy). ${call}`, evidence: [{ label: "What you told me" }] };
    case "seizure":
      return { title: "Seizures need urgent help", text: `${call} Don't put anything in the mouth; turn the person on their side.`, evidence: [{ label: "What you told me" }] };
    case "allergy":
      return { title: "This could be a severe allergic reaction", text: `${call} Use an adrenaline auto-injector if one is prescribed.`, evidence: [{ label: "What you told me" }] };
  }
}

/** The grounded facts sent with a question to the live brain — patterns, not raw logs. */
export function factsFor(m: MindModel, u?: Understanding): string[] {
  const c = m.learned.cycle;
  const p = c.pred;
  const f: string[] = [];
  if (m.stage) f.push(`Life stage: ${m.stage}.`);
  if (m.goals.length) f.push(`Her goals: ${m.goals.map((g) => GOAL_LABEL[g] ?? g).join(", ")}.`);
  if (c.day && c.phase) f.push(`Cycle day ${c.day} (${c.phase} phase); next period estimated ${c.nextStart ? fmtS(c.nextStart) : "unknown"} (window ${p.early ? fmtS(p.early) : "?"}–${p.late ? fmtS(p.late) : "?"}), based on ${p.basis}.`);
  if (c.lengths.length) f.push(`Recent cycle lengths: ${c.lengths.slice(-6).join(", ")} days (${p.regularity}).`);
  const sl = m.metrics.sleep;
  if (sl.baseline) f.push(`Sleep: usual ${r1(sl.baseline.mean)} h${sl.recent ? `, last nights ${r1(sl.recent.mean)} h` : ""}.`);
  const md = m.metrics.mood;
  if (md.baseline) f.push(`Mood (1–5): usual ${r1(md.baseline.mean)}${md.recent ? `, lately ${r1(md.recent.mean)}` : ""}.`);
  m.symptoms.slice(0, 5).forEach((x) => f.push(`Symptom ${x.name}: ${x.entries} entries over ${x.cycles} cycles, avg ${x.avgSeverity}/10, ${x.inPeriod >= 0.5 ? "mostly during her period" : x.beforePeriod >= 0.4 ? "mostly before her period" : "spread across the cycle"}.`));
  m.labs.forEach((l) => f.push(`Lab ${l.name}: ${l.latest} ${l.unit}${l.flag ? ` (${l.flag}; range ${l.low ?? "?"}–${l.high ?? "?"})` : ""} on ${fmtS(l.at)}.`));
  if (m.bp) f.push(`Blood pressure 30-day average ${m.bp.sys}/${m.bp.dia} (${m.bp.category}).`);
  m.links.forEach((l) => f.push(l.text));
  m.learned.memory.filter((x) => x.kind === "told").forEach((x) => f.push(`She told OVEREO: ${x.text}`));
  if (m.meds.length) f.push(`Medicines she logs: ${m.meds.map((x) => x.name).join(", ")}.`);
  m.insights.slice(0, 4).forEach((i) => f.push(`Current: ${i.title}.`));
  // put the facts closest to the question first
  if (u) {
    const key = u.lab ?? u.symptom ?? (u.intent === "sleep" ? "Sleep" : u.intent === "mood" ? "Mood" : null);
    if (key) f.sort((a, b) => Number(b.toLowerCase().includes(key.toLowerCase())) - Number(a.toLowerCase().includes(key.toLowerCase())));
  }
  return f.slice(0, 40);
}
