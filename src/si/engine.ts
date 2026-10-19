import { store, updateProfile, resetProfile } from "../core/store";
import { derive } from "../core/derived";
import { latest } from "../core/persona";
import { medianAmh } from "../core/engines/clock";
import { PHASE_META } from "../core/engines/forecast";
import { levelLabel, type Signal } from "../core/engines/signals";
import { LEVERS } from "../core/engines/futures";
import { FACTS, OVARY_FACT, MENSTRUAL_FACT } from "../core/research";
import { labelFor, type Command } from "../core/bus";
import { PLATFORM_INTENTS, KNOWLEDGE_INTENT, CONDITION_INTENT, platformSuggestions } from "./platform";
import { fmtDate, round } from "../core/rng";
import { narrateProfileChange } from "../core/insights";
import type { SIAnswer, SIContext } from "./types";

/* =====================================================================
   Overeo SI — local intelligence engine.

   Deterministic and grounded: every answer is assembled from the same
   derived data the page draws (clock, signals, forecast, futures), and
   says what it used, what it didn't have, and where its limits are.
   It never diagnoses, never doses, and puts safety first.

   When NEXT_PUBLIC_SI_ENDPOINT is set, provider.ts sends the same context to a
   live model instead and falls back here on any error.
   ===================================================================== */

const fact = (id: string) => FACTS.find((f) => f.id === id)!;
const src = (id: string) => {
  const f = fact(id);
  return { label: f.source, url: f.url };
};

type Handler = (q: string, ctx: SIContext, m: RegExpMatchArray) => SIAnswer | null;
interface Intent {
  id: string;
  re: RegExp;
  run: Handler;
}

function data(ctx: SIContext) {
  const s = store.get();
  const d = derive(s.profile, s.levers);
  return { s, d, p: s.profile, use: ctx.useProfile };
}

const notUsing = "Not using her profile for this answer (you turned that context off).";

/* ------------------------------ commands ------------------------------ */

const sectionAlias: [RegExp, string][] = [
  [/timing|when to test/, "tests:timing"],
  [/test|navigator|labs? to take/, "tests"],
  [/pain map/, "tools:pain"],
  [/pcos/, "spec:hormones"],
  [/menopause scale|mrs/, "tools:mrs"],
  [/tools?|check.?in|questionnaire/, "tools"],
  [/today|dashboard for today|my day/, "today"],
  [/fertility|egg/, "spec:fertility"],
  [/menstrual|endometriosis|period (pain|health|page)|heavy periods?/, "spec:menstrual-health"],
  [/menopause/, "spec:menopause"],
  [/heart (health|page|care|specialty)|cardiolog/, "spec:heart"],
  [/bone (health|page|specialty)|osteopor/, "spec:bone"],
  [/skin|nea\b/, "spec:skin"],
  [/gut|nutrition|microbiome/, "spec:gut"],
  [/\bmind\b|mental health|sleep (care|page|specialty)/, "spec:mind-sleep"],
  [/longevity|genom/, "spec:longevity"],
  [/specialt/, "specialties"],
  [/visit|appointment/, "visit"],
  [/evidence|library/, "evidence"],
  [/clock|ovar(y|ian)|reproductive age/, "clock"],
  [/lens|cycle|phase|temperature|forecast/, "lens"],
  [/radar|signal|pattern/, "radar"],
  [/future|simulat|healthspan/, "futures"],
  [/agent|book/, "agent"],
  [/ecosystem|partner|neyu|bioaro|biongevity|care team/, "ecosystem"],
  [/map|commons|research|world/, "commons"],
  [/privacy|consent|encrypt/, "privacy"],
  [/app|phone|mobile/, "app"],
  [/labs|2035|menstrual/, "labs"],
  [/join|sign ?up|waitlist/, "join"],
  [/gap|research facts|stat/, "gap"],
  [/converg|stream|sources/, "converge"],
  [/home|top|start|hero/, "hero"],
];

const COMMANDS: Intent[] = [
  {
    id: "theme",
    re: /\b(dark|light|auto(matic)?)\s*(mode|theme)\b|\b(switch|go|turn|make it)\s+(to\s+)?(dark|light)\b/,
    run: (q) => {
      const v = /dark/.test(q) ? "dark" : /light/.test(q) ? "light" : "auto";
      return {
        title: `Theme: ${v}`,
        summary: v === "auto" ? "I'll follow your system appearance from now on." : `Switched to ${v} mode. Glass materials re-tint automatically.`,
        used: ["Your request"],
        effects: [{ type: "theme", value: v }],
        tone: "good",
      };
    },
  },
  {
    id: "mood",
    re: /\b(calm|focus|energi[sz]e|night)\s+(mode|lighting|mood|light)\b|^(calm|focus|energi[sz]e|night|auto mood)$|\bmood lighting\b|\bchange (the )?mood\b/,
    run: (q) => {
      const v = /calm/.test(q) ? "calm" : /focus/.test(q) ? "focus" : /energi|energy/.test(q) ? "energize" : /night/.test(q) ? "night" : "auto";
      return {
        title: `Mood lighting: ${v}`,
        summary:
          v === "auto"
            ? "Lighting now adapts on its own — to the time of day and to her cycle phase."
            : `The light now feels ${v === "calm" ? "softer and slower" : v === "focus" ? "cooler and quieter" : v === "energize" ? "brighter and quicker" : "dim and deep"}.`,
        used: ["Your request"],
        effects: [{ type: "mood", value: v }],
        tone: "good",
      };
    },
  },
  {
    id: "space",
    re: /\b(space|spatial|3d dashboard|dashboard)\b/,
    run: () => ({
      title: "Entering Space",
      summary: "Her whole picture as a spatial dashboard. Drag or swipe to turn it, pinch to move closer, Esc to come back.",
      used: ["Your request"],
      effects: [{ type: "mode", value: "space" }],
    }),
  },
  {
    id: "ar",
    re: /\b(ar|augmented|webxr|in my room|camera mode)\b/,
    run: () => ({
      title: "AR mode",
      summary: "Opening the Ovarian Clock in your space. On supported phones it uses WebXR; elsewhere, your camera with a 3D overlay.",
      used: ["Your request"],
      effects: [{ type: "mode", value: "ar" }],
    }),
  },
  {
    id: "goto",
    re: /\b(go to|open|show( me)?|take me to|navigate to|jump to)\b(.+)/,
    run: (q, _c, m) => {
      const target = m[3] ?? q;
      const hit = sectionAlias.find(([re]) => re.test(target));
      if (!hit) return null;
      const id = hit[1];
      const label = labelFor(id);
      return { title: `Opening ${label}`, summary: `Taking you to ${label}.`, used: ["Your request"], effects: [{ type: "goto", section: id }] };
    },
  },
  {
    id: "print",
    re: /\b(print|dossier|doctor.?ready|summary for (my )?(doctor|clinician))\b/,
    run: () => ({
      title: "Printing her dossier",
      summary: "Assembling her strongest patterns, evidence and questions into one page a clinician can read in a minute.",
      used: ["Silent Signals", "Lab history", "Ovarian Clock"],
      effects: [{ type: "goto", section: "radar" }, { type: "print-dossier" }],
      tone: "info",
    }),
  },
  {
    id: "agent",
    re: /\b(book|schedule|arrange|run the agent|start the agent|make (an |the )?appointment)\b/,
    run: () => ({
      title: "Agent plan ready",
      summary: "I've drafted a plan: repeat ferritin with at-home collection, a virtual visit about the pain pattern, and a 90-day retest. Nothing happens until you approve each step.",
      used: ["Silent Signals", "NEYU services"],
      limits: "Prototype — no real bookings are made.",
      effects: [{ type: "goto", section: "agent" }, { type: "run-agent" }],
    }),
  },
  {
    id: "set-age",
    re: /\b(?:i am|i'm|my age is|set (?:my |her )?age(?: to)?)\s*(\d{2})\b/,
    run: (_q, _c, m) => {
      const age = Math.max(18, Math.min(70, parseInt(m[1], 10)));
      updateProfile((p) => ({ ...p, age, isSample: false, name: p.name === "Maya" ? "You" : p.name }));
      narrateProfileChange(`Age set to ${age}`);
      const s = store.get();
      const d = derive(s.profile, s.levers);
      return {
        title: `Age set to ${age}`,
        summary: `Recalculated everything for age ${age}. Ovarian Clock marker age: ${d.clock.markerAge} — ${d.clock.verdict}.`,
        used: ["Your age", "Existing markers"],
        actions: [{ label: "See the clock", icon: "clock", cmds: [{ type: "goto", section: "clock" }] }],
        viz: "clock",
      };
    },
  },
  {
    id: "set-amh",
    re: /(?:^|\bset\s+(?:her\s+|my\s+)?|\bmy\s+)amh(?:\s+(?:is|to|=)|\s*=)?\s*(\d+(?:\.\d+)?)\s*$/,
    run: (_q, _c, m) => {
      const v = Math.max(0.05, Math.min(15, parseFloat(m[1])));
      updateProfile((p) => ({ ...p, isSample: false, markers: { ...p.markers, amh: v } }));
      narrateProfileChange(`AMH set to ${v}`);
      const s = store.get();
      const d = derive(s.profile, s.levers);
      return {
        title: `AMH updated to ${v} ng/mL`,
        summary: `Marker age is now ${d.clock.markerAge} (${d.clock.verdict}). Remember: AMH reflects egg quantity, not quality.`,
        used: ["AMH you entered", "Age", "FSH", "Cycle rhythm"],
        limits: "Assays differ between labs; compare like with like.",
        viz: "clock",
      };
    },
  },
  {
    id: "set-fsh",
    re: /(?:^|\bset\s+(?:her\s+|my\s+)?|\bmy\s+)fsh(?:\s+(?:is|to|=)|\s*=)?\s*(\d+(?:\.\d+)?)\s*$/,
    run: (_q, _c, m) => {
      const v = Math.max(1, Math.min(80, parseFloat(m[1])));
      updateProfile((p) => ({ ...p, isSample: false, markers: { ...p.markers, fsh: v } }));
      narrateProfileChange(`FSH set to ${v}`);
      const s = store.get();
      const d = derive(s.profile, s.levers);
      return {
        title: `FSH updated to ${v} IU/L`,
        summary: `Marker age now ${d.clock.markerAge}. FSH only means something on cycle days 2–4, read alongside oestradiol.`,
        used: ["FSH you entered"],
        viz: "clock",
      };
    },
  },
  {
    id: "redflag",
    re: /\b(i have|i'?m having|having|i feel|i've got|i got|my)\s+(a\s+)?(chest (pain|pressure|tightness)|crushing|heart attack)|\bmy chest (hurts|is tight)|\bi can'?t breathe\b/,
    run: () => {
      updateProfile((p) => ({ ...p, redFlags: { chestPain: true, breathless: true, jawPain: p.redFlags.jawPain } }));
      return {
        title: "This needs care now, not a pattern",
        summary:
          "If you have chest pain, pressure, breathlessness, or pain spreading to the jaw, back or arm right now — call 911 (or your local emergency number). Don't drive yourself.",
        points: [
          "Women often have symptoms beyond classic chest pain: breathlessness, nausea, unusual fatigue, jaw or back pain.",
          "Women are more likely than men to have a heart attack initially misdiagnosed — say clearly that you're worried about your heart.",
        ],
        used: ["What you just told me"],
        limits: "I can't assess an emergency. Emergency services can.",
        tone: "alert",
        actions: [{ label: "Clear this flag", icon: "close", cmds: [{ type: "toast", text: "Flag kept until you clear it in Space → Quick log." }] }],
      };
    },
  },
  {
    id: "reset",
    re: /\b(reset|start over|restore (the )?sample|back to maya)\b/,
    run: () => {
      resetProfile();
      store.set({ levers: { strength: false, sleep: false, iron: false, menoCare: false, nutrition: false } });
      narrateProfileChange("Reset to the sample profile");
      return { title: "Reset", summary: "Back to Maya's sample profile. Every chart and signal has been recalculated.", used: ["Sample profile"], tone: "good" };
    },
  },
  {
    id: "lever",
    re: /\bwhat if\b|\b(simulate|turn on|switch on)\b.*\b(strength|lift|weights|iron|sleep|nutrition|mediterranean|diet|menopause)/,
    run: (q) => {
      const keys = LEVERS.filter((l) =>
        l.key === "strength" ? /strength|lift|weights|exercise/.test(q) :
        l.key === "iron" ? /iron/.test(q) :
        l.key === "sleep" ? /sleep/.test(q) :
        l.key === "nutrition" ? /mediterranean|nutrition|diet|eat/.test(q) :
        /menopause|hrt|mht/.test(q),
      );
      const chosen = keys.length ? keys : LEVERS.slice(0, 2);
      const cmds: Command[] = chosen.map((l) => ({ type: "lever", key: l.key, on: true }));
      const s = store.get();
      const lv = { ...s.levers };
      chosen.forEach((l) => (lv[l.key] = true));
      const d = derive(s.profile, lv);
      return {
        title: "Simulating two futures",
        summary: `Switched on: ${chosen.map((c) => c.label.toLowerCase()).join(", ")}. In this illustrative model her healthspan index stays above 60 until about ${d.futures.healthspanB >= 80 ? "80+" : d.futures.healthspanB} (vs ${d.futures.healthspanA}).`,
        used: ["Her age", "Iron status", "Levers you chose"],
        limits: "Illustrative trajectories to support a conversation — not a prediction of your health.",
        effects: [...cmds, { type: "goto", section: "futures" }],
        viz: "futures",
        tone: "good",
      };
    },
  },
];

/* ------------------------------- topics ------------------------------- */

const signalAnswer = (sig: Signal | undefined, ctx: SIContext, title: string, intro: string, extra: Partial<SIAnswer> = {}): SIAnswer => {
  if (!sig || !ctx.useProfile)
    return {
      title,
      summary: intro,
      used: ["General knowledge"],
      missing: [ctx.useProfile ? "Enough entries to see a pattern" : notUsing],
      ...extra,
    };
  return {
    title,
    summary: `${intro} In her entries this is a ${levelLabel[sig.level].toLowerCase()} — ${Math.round(sig.strength * 100)}% consistency across cycles.`,
    points: sig.evidence,
    used: ["Six cycles of daily logs", "Lab history", "Wearable trends"],
    missing: ["Clinical examination", "Imaging"],
    limits: "Pattern strength describes how consistent the entries are — not the chance of having a condition.",
    questions: sig.questions,
    actions: [
      { label: "See it on the radar", icon: "radar", cmds: [{ type: "goto", section: "radar" }] },
      { label: "Print dossier", icon: "printer", cmds: [{ type: "goto", section: "radar" }, { type: "print-dossier" }] },
    ],
    tone: "signal",
    viz: "signals",
    ...extra,
  };
};

const TOPICS: Intent[] = [
  {
    id: "gap",
    re: /\b(diagnosed later|later diagnos|health gap|women('s)? health gap|ignored|underserved|why are women)\b/,
    run: () => ({
      title: "Why women are diagnosed later",
      summary: `Across ${fact("dx").value} diseases, a 21-year Danish population study found women were diagnosed later than men — cancer about 2.5 years later, metabolic disease about 4.5. Medicine was largely studied in men, and women's symptoms are more often read as "normal" or stress.`,
      points: [
        `Endometriosis: ~${fact("endo").value} years on average to diagnosis.`,
        `${fact("adr").value}× more adverse drug reactions, partly from male-based dosing.`,
        `Women spend ~${fact("gap").value}% more of life in poor health.`,
      ],
      used: ["Peer-reviewed research"],
      actions: [{ label: "See the gap", icon: "trend", cmds: [{ type: "goto", section: "gap" }] }],
      sources: [src("dx"), src("endo"), src("gap")],
    }),
  },
  {
    id: "sources",
    re: /\b(what data|data do you|which data|sources|what do you read|streams?|i'?m reading)\b/,
    run: (_q, ctx) => {
      const { p } = data(ctx);
      return {
        title: "What I read — together",
        summary: "Eight streams converge: cycle logs, wearable temperature and heart rate, sleep, BioAro lab results, genome flags, microbiome, symptoms she describes, and clinician notes from BioEMR.",
        points: ctx.useProfile ? [`${p.logs.length} days of entries`, `${p.labs.length} lab series`, `${p.genome.length} genome flags, ${p.microbiome.length} microbiome results`] : undefined,
        used: ctx.useProfile ? ["Her profile"] : ["General knowledge"],
        actions: [{ label: "Watch them converge", icon: "layers", cmds: [{ type: "goto", section: "converge" }] }],
      };
    },
  },
  {
    id: "agentinfo",
    re: /\b(agent|what will you do for)\b/,
    run: () => ({
      title: "The OVEREO Agent",
      summary: "It turns insight into action: booking a BioAro panel with at-home collection, preparing a NEYU virtual visit, sending the dossier to the right clinician and scheduling a retest. Every step waits for your approval.",
      used: ["Agent design"],
      limits: "Prototype — no real bookings are made.",
      actions: [{ label: "Run the agent", icon: "bolt", cmds: [{ type: "goto", section: "agent" }, { type: "run-agent" }] }],
    }),
  },
  {
    id: "app",
    re: /\b(the app|an app|mobile|iphone|android|download|in your pocket)\b/,
    run: () => ({
      title: "The OVEREO app",
      summary: "The same intelligence in your pocket: today's cycle phase and forecast, the Ovarian Clock, Silent Signals, Overeo SI by voice, and the dossier ready before every appointment.",
      used: ["Product concept"],
      limits: "Concept — not in app stores yet.",
      actions: [{ label: "See the screens", icon: "phone", cmds: [{ type: "goto", section: "app" }] }],
    }),
  },
  {
    id: "join",
    re: /\b(join|sign ?up|waitlist|early access)\b/,
    run: () => ({
      title: "Joining OVEREO",
      summary: "Just a name and an email — no health information. You'll get early access as features open, starting in Calgary.",
      used: ["Join flow"],
      actions: [{ label: "Join now", icon: "user", cmds: [{ type: "goto", section: "join" }] }],
    }),
  },
  {
    id: "labs2035",
    re: /\b(menstrual[ -](blood|fluid)|tampon|period blood|2035|labs|needle.?free|ovarian (ageing|aging)|slow(ed)? (the )?(clock|ageing|aging))\b/,
    run: () => ({
      title: "Every period becomes data",
      summary: `${MENSTRUAL_FACT.text} OVEREO Labs imagines a monthly, painless biomarker stream — and ovarian-longevity research to slow the clock itself.`,
      used: ["Published research"],
      limits: "Research stage — not an available test.",
      actions: [{ label: "Open OVEREO Labs", icon: "flask", cmds: [{ type: "goto", section: "labs" }] }],
      sources: [{ label: MENSTRUAL_FACT.source, url: MENSTRUAL_FACT.url }],
    }),
  },
  {
    id: "diagnose",
    re: /\b(do i have|have i got|is it|diagnos(e|is) me|am i sick|what'?s wrong with me)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      const top = d.signals.filter((s) => s.level !== "watch").slice(0, 2);
      return {
        title: "I can't diagnose — but I can show you the pattern",
        summary:
          "A diagnosis needs a clinician, an examination and sometimes imaging or tests. What I can do is make the pattern impossible to miss, so the conversation starts in the right place.",
        points: ctx.useProfile ? top.map((s) => `${s.title}: ${s.short} (${levelLabel[s.level]})`) : undefined,
        used: ctx.useProfile ? ["Silent Signals"] : ["General knowledge"],
        questions: top[0]?.questions,
        actions: [
          { label: "Open Silent Signals", icon: "radar", cmds: [{ type: "goto", section: "radar" }] },
          { label: "Ask the agent to book", icon: "bolt", cmds: [{ type: "goto", section: "agent" }, { type: "run-agent" }] },
        ],
      };
    },
  },
  {
    id: "signals",
    re: /\b(silent signals?|what patterns|patterns (have )?you (noticed|found|see)|anything (i|she) should know|what should i (worry|know))\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      if (!ctx.useProfile || !ctx.useSignals)
        return { title: "Silent Signals", summary: "I look across months of entries for patterns that research shows are recognised late in women. Turn her profile and signals context back on and I'll show you hers.", used: ["General knowledge"], missing: [notUsing] };
      const shown = d.signals.filter((s) => s.level !== "watch");
      return {
        title: `${shown.length} pattern${shown.length === 1 ? "" : "s"} worth a conversation`,
        summary: `Across ${d.profile.logs.length} days, these stand out. Strength is consistency across cycles — not the chance of a condition.`,
        points: d.signals.map((s) => `${s.title} — ${levelLabel[s.level]} (${Math.round(s.strength * 100)}%): ${s.evidence[0]}`),
        used: ["Daily logs", "Lab history", "Wearable trends"],
        questions: shown[0]?.questions,
        actions: [
          { label: "Open Silent Signals", icon: "radar", cmds: [{ type: "goto", section: "radar" }] },
          { label: "Print dossier", icon: "printer", cmds: [{ type: "goto", section: "radar" }, { type: "print-dossier" }] },
        ],
        viz: "signals",
        tone: "signal",
      };
    },
  },
  {
    id: "clock",
    re: /\b(ovarian clock|clock|reproductive age|biological clock|marker age|how old are my ovaries)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      if (!ctx.useProfile)
        return {
          title: "The Ovarian Clock",
          summary:
            "It expresses reproductive markers as the age at which they're most typical — a way to see timing and options. It's built from AMH, FSH, cycle rhythm, family history and epigenetic age.",
          used: ["General knowledge"],
          missing: [notUsing],
          sources: [{ label: OVARY_FACT.source, url: OVARY_FACT.url }],
        };
      const c = d.clock;
      return {
        title: `Ovarian Clock: ${c.markerAge} vs ${c.calendarAge}`,
        summary: `Her reproductive markers are ${c.verdict}. The likely range is ${c.band[0]}–${c.band[1]}. ${OVARY_FACT.text}`,
        points: c.factors.map((f) => `${f.label}: ${f.years >= 0 ? "+" : ""}${f.years} y — ${f.why}`),
        used: ["AMH", "Day-3 FSH", "Cycle lengths", "Epigenetic age"],
        missing: ["Antral follicle count (ultrasound)", "Assay-specific reference curve"],
        limits: "Illustrative model. AMH reflects egg quantity, not quality, and doesn't predict natural conception.",
        questions: ["What do my markers mean for my timeline and options?", "Would an antral follicle count add useful information?"],
        actions: [
          { label: "Open the clock", icon: "clock", cmds: [{ type: "goto", section: "clock" }] },
          { label: "View in AR", icon: "ar", cmds: [{ type: "mode", value: "ar" }] },
        ],
        viz: "clock",
        sources: [{ label: OVARY_FACT.source, url: OVARY_FACT.url }],
      };
    },
  },
  {
    id: "amh",
    re: /\b(amh|anti.?m(u|ü)llerian|ovarian reserve|egg (count|supply|reserve))\b/,
    run: (_q, ctx) => {
      const { p } = data(ctx);
      const v = p.markers.amh;
      const med = round(medianAmh(p.age), 2);
      return {
        title: "AMH, in plain language",
        summary:
          "AMH is made by small follicles in the ovaries, so it gives a rough picture of how many eggs remain. It says little about egg quality and doesn't predict whether you'll conceive naturally in the next year.",
        points: [
          ctx.useProfile ? `Her AMH: ${v} ng/mL. A typical value at ${p.age} is around ${med} on this curve.` : "AMH falls gradually with age and varies a lot between people.",
          "It's fairly stable across the cycle, so it can be drawn on any day.",
          "Hormonal contraception can lower AMH a little; assays differ between labs.",
          "Most useful for planning egg freezing or IVF, where it helps predict how many eggs might be collected.",
        ],
        used: ctx.useProfile ? ["Her AMH result", "Her age"] : ["General knowledge"],
        missing: ctx.useProfile ? [] : [notUsing],
        questions: ["Given my AMH, how many eggs might a freezing cycle collect?", "Should we repeat it with the same lab?"],
        viz: ctx.useProfile ? "clock" : undefined,
      };
    },
  },
  {
    id: "egg",
    re: /\b(egg freezing|freeze (my )?eggs|fertility preservation|oocyte|ivf|get pregnant|fertility)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      return {
        title: "Thinking about egg freezing",
        summary:
          "The single biggest factor in later success is the age at which eggs are frozen. AMH helps estimate how many eggs a cycle might yield; it doesn't tell you whether those eggs will lead to a baby. A fertility specialist can turn your numbers into a personal plan.",
        points: [
          ctx.useProfile ? `Her Ovarian Clock: markers ${d.clock.verdict}.` : "Markers to bring: AMH, day-3 FSH and oestradiol, and an antral follicle count.",
          "One cycle may not be enough; the number needed depends on age and goals.",
          "OVEREO doesn't perform treatment — it prepares you and routes to qualified fertility clinics.",
        ],
        used: ctx.useProfile ? ["Ovarian Clock", "Lab history"] : ["General knowledge"],
        limits: "No promises about outcomes — success rates depend on age, eggs and the clinic.",
        questions: ["How many eggs would you aim to freeze for someone like me?", "What does a cycle involve, and what does it cost?", "How does my pain pattern affect fertility planning?"],
        actions: [
          { label: "See her clock", icon: "clock", cmds: [{ type: "goto", section: "clock" }] },
          { label: "Prepare a consult", icon: "bolt", cmds: [{ type: "goto", section: "agent" }, { type: "run-agent" }] },
        ],
      };
    },
  },
  {
    id: "endo",
    re: /\b(endometriosis|adenomyosis|period pain|painful period|cramps|pelvic pain|dysmenorrh|pain with sex)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      return signalAnswer(
        d.signals.find((s) => s.id === "endo"),
        ctx,
        "Painful periods aren't something to just push through",
        "Period pain that stops you functioning, pain with sex, or bowel pain during periods can point to endometriosis or adenomyosis — and on average these take about a decade to diagnose.",
        { sources: [src("endo")] },
      );
    },
  },
  {
    id: "iron",
    re: /\b(iron|ferritin|anaemi|anemi|tired|fatigue|exhausted|no energy|heavy (period|bleeding|flow))\b/,
    run: (_q, ctx) => {
      const { d, p } = data(ctx);
      const ferr = p.labs.find((l) => l.key === "ferritin")!;
      return signalAnswer(
        d.signals.find((s) => s.id === "iron"),
        ctx,
        "Why she might be running on empty",
        `Ferritin shows iron stores. Heavy periods drain them month after month, and fatigue can arrive long before anaemia shows on a blood count.${ctx.useProfile ? ` Her latest ferritin: ${latest(ferr).value} ${ferr.unit}.` : ""}`,
        { limits: "Ferritin can look falsely normal during inflammation. Treatment decisions belong with a clinician." },
      );
    },
  },
  {
    id: "pcos",
    re: /\b(pcos|polycystic|irregular (period|cycle)s?|late period|missed period|acne|hair growth)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      return signalAnswer(
        d.signals.find((s) => s.id === "rhythm"),
        ctx,
        "Cycle rhythm and PCOS",
        "PCOS is usually diagnosed when two of three are present — irregular ovulation, signs of higher androgens, and a polycystic pattern on ultrasound — after other causes are ruled out. One odd cycle means little; months of pattern matter.",
      );
    },
  },
  {
    id: "sleep",
    re: /\b(sleep|insomnia|can'?t sleep|wake up|night sweats|mood swings|pms|pmdd)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      return signalAnswer(
        d.signals.find((s) => s.id === "luteal"),
        ctx,
        "Sleep that follows the cycle",
        "Progesterone and temperature both rise after ovulation, and the days before a period are when many women sleep worst. Timing support to the cycle can help more than generic sleep advice.",
        { actions: [{ label: "Show the Cycle Lens", icon: "cycle", cmds: [{ type: "lens", metric: "sleep" }, { type: "goto", section: "lens" }] }] },
      );
    },
  },
  {
    id: "meno",
    re: /\b(menopause|perimenopause|peri|hot flush|hot flash|hrt|mht|hormone therapy)\b/,
    run: (_q, ctx) => {
      const { p } = data(ctx);
      return {
        title: "Menopause — you deserve answers, not dismissal",
        summary:
          "The average age of menopause is about 51, and perimenopause can start years earlier with cycle changes, sleep disruption, hot flushes, mood and brain-fog. Effective, evidence-based options exist, including menopausal hormone therapy — whether it suits you depends on age, timing and your own history.",
        points: [
          `${fact("meno").value}% of midlife women with symptoms in a Mayo Clinic survey hadn't sought care.`,
          "Track hot flushes, night sweats, sleep and cycle changes — patterns make the conversation faster.",
          ctx.useProfile && p.age < 40 ? `At ${p.age}, her markers are about planning ahead, not perimenopause.` : "Bone and heart health change after menopause; it's a window for prevention.",
        ],
        used: ["General knowledge", ctx.useProfile ? "Her age" : ""].filter(Boolean),
        questions: ["Could my symptoms be perimenopause?", "What are my options, and their benefits and risks for me?"],
        actions: [{ label: "Plan menopause care in Future Self", icon: "trend", cmds: [{ type: "lever", key: "menoCare", on: true }, { type: "goto", section: "futures" }] }],
        sources: [src("meno")],
      };
    },
  },
  {
    id: "heart",
    re: /\b(heart|cardio|blood pressure|palpitation|cholesterol)\b/,
    run: () => ({
      title: "Women's hearts are under-recognised",
      summary:
        "Heart disease is a leading cause of death in women, and women are more often initially misdiagnosed during a heart attack. Symptoms can be breathlessness, nausea, unusual tiredness or jaw/back pain — not only chest pain.",
      points: ["If symptoms are happening now, call 911.", "After menopause, cardiovascular risk rises — prevention starts earlier.", "Advanced Cardiology and NEYU run in-house heart care and remote BP monitoring."],
      used: ["General knowledge"],
      actions: [{ label: "See the ecosystem", icon: "globe", cmds: [{ type: "goto", section: "ecosystem" }] }],
    }),
  },
  {
    id: "drugs",
    re: /\b(drug|medication|medicine|dose|dosage|side effect|pill|prescription|cyp2c19|pharmacogen)\b/,
    run: (_q, ctx) => {
      const { p } = data(ctx);
      const cyp = p.genome.find((g) => g.label === "CYP2C19");
      return {
        title: "Medicines weren't dosed with women in mind",
        summary: `Women experience adverse drug reactions nearly twice as often as men, partly because doses came from trials of mostly men. In 2013 the FDA halved the recommended starting dose of zolpidem for women for this reason.`,
        points: [
          ctx.useProfile && cyp ? `Her genome: CYP2C19 ${cyp.value.toLowerCase()} — relevant to some antidepressants, acid-reducers and clopidogrel.` : "Pharmacogenomic testing can show how your genes process certain medicines.",
          "Never change a dose yourself — bring this to your prescriber or pharmacist.",
        ],
        used: ctx.useProfile ? ["Her pharmacogenomic flags"] : ["General knowledge"],
        limits: "I don't give dosing advice.",
        questions: ["Does my CYP2C19 result change anything I take now?", "Is this dose right for my body?"],
        sources: [src("adr")],
      };
    },
  },
  {
    id: "today",
    re: /\b(next period|when.*period|cycle day|what day|which phase|phase am i|ovulat|fertile window|today|forecast)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      const t = d.today;
      if (!ctx.useProfile) return { title: "Cycle forecast", summary: "I'd need her cycle history to forecast.", used: [], missing: [notUsing] };
      return {
        title: `Cycle day ${t.cycleDay} · ${PHASE_META[t.phase].label}`,
        summary: `${PHASE_META[t.phase].desc} Next period predicted around ${fmtDate(t.nextStart)} (in ${t.daysUntil} days, ±${Math.max(1, Math.round(t.sdLength))}).`,
        points: [`Average cycle ${t.meanLength} days, varying by ±${t.sdLength}.`, `Estimated fertile window last cycle: ${fmtDate(t.fertile[0])}–${fmtDate(t.fertile[1])}.`],
        used: ["Six cycles of start dates", "Skin-temperature shift"],
        limits: "Forecasts aren't contraception and get less certain the further ahead they look.",
        actions: [{ label: "Open the Cycle Lens", icon: "cycle", cmds: [{ type: "goto", section: "lens" }] }],
        viz: "forecast",
      };
    },
  },
  {
    id: "lens",
    re: /\b(temperature|resting heart|heart rate|hrv|wearable|watch|ring)\b/,
    run: () => ({
      title: "The Cycle-Aware Lens",
      summary:
        "Temperature, resting heart rate and sleep all shift with the cycle. Reading them against her phase turns noise into signal — and it's how I date her phases even without a period log.",
      used: ["Wearable trends", "Cycle history"],
      actions: [
        { label: "Show temperature", icon: "cycle", cmds: [{ type: "lens", metric: "temp" }, { type: "goto", section: "lens" }] },
        { label: "Show resting heart rate", icon: "heart", cmds: [{ type: "lens", metric: "rhr" }, { type: "goto", section: "lens" }] },
      ],
      viz: "forecast",
    }),
  },
  {
    id: "futures",
    re: /\b(future|healthspan|longevity|at (age )?\d{2}|when she'?s \d{2}|ageing|aging|simulate|two futures)\b/,
    run: (_q, ctx) => {
      const { d } = data(ctx);
      return {
        title: "Two futures",
        summary: `Path A keeps today's habits; Path B adds the levers you choose. Right now the illustrative gain is ${d.futures.gain > 0 ? `~${d.futures.gain} years` : "zero — switch on a lever"}. Strength training moves bone the most after 40; planning menopause care early bends the curve after 51.`,
        used: ["Her age", "Iron status", "Levers"],
        limits: "Illustrative model for conversation, not a prediction.",
        actions: [
          { label: "Switch on strength + sleep", icon: "trend", cmds: [{ type: "lever", key: "strength", on: true }, { type: "lever", key: "sleep", on: true }, { type: "goto", section: "futures" }] },
          { label: "Open Future Self", icon: "trend", cmds: [{ type: "goto", section: "futures" }] },
        ],
        viz: "futures",
      };
    },
  },
  {
    id: "genome",
    re: /\b(genome|genetic|dna|brca|gene|hereditary)\b/,
    run: (_q, ctx) => {
      const { p } = data(ctx);
      return {
        title: "Her genome, handled carefully",
        summary:
          "Genetic information can reveal things about you and your relatives and can't be changed — so OVEREO keeps it off by default and asks for a separate yes for every use.",
        points: ctx.useProfile ? p.genome.map((g) => `${g.label}: ${g.value} — ${g.note}`) : undefined,
        used: ctx.useProfile ? ["Consented genome flags"] : ["General knowledge"],
        actions: [{ label: "Open Privacy", icon: "lock", cmds: [{ type: "goto", section: "privacy" }] }],
      };
    },
  },
  {
    id: "micro",
    re: /\b(microbiome|gut|vaginal|lactobacill|bacteria)\b/,
    run: (_q, ctx) => {
      const { p } = data(ctx);
      return {
        title: "Microbiome",
        summary: "BioAro Labs and NEA test gut, skin and vaginal microbiomes. Clinical usefulness varies by test — some findings guide care, many are still research.",
        points: ctx.useProfile ? p.microbiome.map((m) => `${m.label}: ${m.value}`) : undefined,
        used: ctx.useProfile ? ["Her microbiome results"] : ["General knowledge"],
      };
    },
  },
  {
    id: "privacy",
    re: /\b(privacy|private|data|consent|share my|who sees|secure|encrypt|delete)\b/,
    run: () => ({
      title: "Your data, your decisions",
      summary:
        "Each kind of information has its own switch. Genetic data starts off. I only use the context chips you can see at the top of this window — remove one and I stop using it.",
      used: ["OVEREO's proposed privacy model"],
      limits: "Prototype — the controls demonstrate the design; they aren't a legal consent mechanism yet.",
      actions: [{ label: "Open Privacy", icon: "lock", cmds: [{ type: "goto", section: "privacy" }] }],
    }),
  },
  {
    id: "ecosystem",
    re: /\b(neyu|bioaro|biongevity|nea|advanced cardiology|biomynd|biosport|biogut|bioemr|ecosystem|doctor|clinician|team|who will see)\b/,
    run: () => ({
      title: "One front door, a whole in-house team",
      summary:
        "OVEREO routes every pattern to people inside the ecosystem: NEYU for care and virtual visits, BioAro Labs for testing, Advanced Cardiology for heart and endocrinology, Biongevity's digital twin, NEA for skin and microbiome, BioMynd for sleep and mood. Outside clinics fill only the gaps, like egg-freezing procedures.",
      used: ["Ecosystem map"],
      actions: [{ label: "See the ecosystem", icon: "globe", cmds: [{ type: "goto", section: "ecosystem" }] }],
      viz: "ecosystem",
    }),
  },
  {
    id: "commons",
    re: /\b(contribute|science commons|research study|donate data)\b/,
    run: () => ({
      title: "The Women's Science Commons",
      summary: "Women are under-represented in research. With explicit opt-in, contributors share de-identified data with BioAro research — and see which studies it powers, with findings returned to them first.",
      used: ["Proposed programme"],
      actions: [{ label: "Open the map", icon: "globe", cmds: [{ type: "goto", section: "commons" }] }],
      sources: [src("gap")],
    }),
  },
  {
    id: "film",
    re: /\b(film|video|movie)\b/,
    run: () => ({
      title: "The films",
      summary: "Two film slots are ready: the brand film near the top, and the app demo. Drop overeo-brand-film.mp4 and overeo-app-demo.mp4 into public/videos and they play automatically — muted, looping, paused off-screen.",
      used: ["Site configuration"],
    }),
  },
  {
    id: "overeo",
    re: /\b(what is overeo|about overeo|overeo|who is (this|it) for|what do you do|what is this)\b/,
    run: () => ({
      title: "OVEREO",
      summary:
        "A women's precision-health platform: it brings her scattered data together, reads it the way female biology actually works, notices what's easy to miss, and routes her to the right person in the ecosystem — for life.",
      points: ["Collect → test → understand → connect → repeat.", "Built on BioAro's labs and NEYU's care.", "Educational — it informs; clinicians diagnose."],
      used: ["OVEREO brief"],
      actions: [{ label: "Begin the story", icon: "arrow", cmds: [{ type: "goto", section: "gap" }] }],
    }),
  },
  {
    id: "si",
    re: /\b(who are you|what are you|what is si|overeo si|symbiotic|your name|press o|hold o)\b/,
    run: () => ({
      title: "I'm Overeo SI",
      summary:
        "Symbiotic Intelligence — I live alongside her data rather than on top of it. Press O anywhere to call me, hold O to talk. I explain, notice patterns, act when you approve, and always show what I used.",
      used: ["Myself"],
      points: ["I can change the page: try “dark mode”, “calm mood”, “enter space”, “print dossier”, “AMH 0.9”, “I'm 41”."],
    }),
  },
  {
    id: "feel",
    re: /\b(scared|worried|anxious|afraid|overwhelmed|upset|sad|frustrated|dismissed)\b/,
    run: () => ({
      title: "That's a lot to carry",
      summary:
        "It makes sense to feel that way — especially if you've been told it's \"normal\" for a long time. We can take it one step at a time: what you've noticed, what it could mean, and who to talk to.",
      used: ["What you shared"],
      questions: ["I've had these symptoms for a while and I'm worried. What should we look at first?"],
      actions: [{ label: "Show me the pattern", icon: "radar", cmds: [{ type: "goto", section: "radar" }] }],
      tone: "good",
    }),
  },
  {
    id: "help",
    re: /\b(help|what can you do|commands|how do i|hi|hello|hey)\b/,
    run: () => ({
      title: "Hi — I'm Overeo SI",
      summary: "Ask me anything about her biology or this page. I can also act: change the theme or mood, open Space or AR, run simulations, print a dossier, or draft an agent plan.",
      points: [
        "“Why is she so tired?”",
        "“What does AMH 1.3 mean?”",
        "“Show me her next period”",
        "“What if she starts strength training?”",
        "“Night mood” · “Enter space” · “Print dossier”",
      ],
      used: ["Myself"],
    }),
  },
];

// Order matters: safety first, then platform questions that would otherwise
// look like navigation, then commands, topics, the specialty guides, and help.
const HELP = TOPICS.filter((t) => t.id === "help");
const CORE_TOPICS = TOPICS.filter((t) => t.id !== "help");
const FOLLOW_UPS = [...PLATFORM_INTENTS.filter((t) => t.id !== "tools"), CONDITION_INTENT, ...CORE_TOPICS, KNOWLEDGE_INTENT, ...HELP];
const PLATFORM_FIRST = PLATFORM_INTENTS.filter((t) => t.id === "tests-rec" || t.id === "test-eval");
const PLATFORM_AFTER = [...PLATFORM_INTENTS.filter((t) => !PLATFORM_FIRST.includes(t)), CONDITION_INTENT];
const ALL = [...COMMANDS.filter((c) => c.id === "redflag"), ...PLATFORM_FIRST, ...COMMANDS.filter((c) => c.id !== "redflag"), ...PLATFORM_AFTER, ...CORE_TOPICS, KNOWLEDGE_INTENT, ...HELP];

/* -------------------------------- answer -------------------------------- */

export function localAnswer(raw: string, ctx: SIContext): SIAnswer {
  let q = raw.toLowerCase().replace(/[’]/g, "'").trim();
  // follow-ups from the SI Live panel: "tell me more about <tag>: <insight>"
  const more = q.match(/^tell me more(?: about ([^:]+))?:\s*(.*)$/);
  if (more) q = `${more[1] ?? ""} ${more[2]}`.trim();
  // follow-ups explain; they never trigger actions on their own
  for (const it of more ? FOLLOW_UPS : ALL) {
    const m = q.match(it.re);
    if (m) {
      const a = it.run(q, ctx, m);
      if (!a) continue;
      a.trace = a.trace ?? traceFor(it.id, ctx);
      return a;
    }
  }
  // Section-aware fallback
  return {
    title: "Let me point you somewhere useful",
    summary: `I don't have a confident answer to that yet. Here on ${labelFor(ctx.section)}, I can explain what you're seeing, or you can ask about her cycle, the Ovarian Clock, the patterns I've noticed, or what to ask a clinician.`,
    used: ["Current page"],
    missing: ["A matching topic in my local knowledge — connect a live model with NEXT_PUBLIC_SI_ENDPOINT for open questions"],
    actions: [
      { label: "What can you do?", icon: "sparkle", cmds: [{ type: "si", seed: "What can you do?" }] },
      { label: "Explain this section", icon: "eye", cmds: [{ type: "si", seed: suggestionsFor(ctx.section)[0] }] },
    ],
    trace: ["Reading your question", "Searching local knowledge"],
  };
}

function traceFor(id: string, ctx: SIContext): string[] {
  const s = store.get();
  const n = s.profile.logs.length;
  const base = ["Understanding the question"];
  if (["theme", "mood", "space", "ar", "goto"].includes(id)) return ["Understanding the request", "Updating the interface"];
  if (!ctx.useProfile) return [...base, "Using general knowledge only"];
  if (["endo", "iron", "pcos", "sleep", "diagnose"].includes(id)) return [...base, `Reading ${n} days of entries`, "Cross-checking labs and wearables", "Scoring pattern consistency"];
  if (["clock", "amh", "egg", "set-amh", "set-age", "set-fsh"].includes(id)) return [...base, "Reading AMH, FSH and cycle rhythm", "Recomputing the Ovarian Clock"];
  if (["today", "lens"].includes(id)) return [...base, "Learning her cycle shape", "Projecting the next 35 days"];
  if (["futures", "lever"].includes(id)) return [...base, "Running both trajectories to age 80"];
  if (["tests-rec", "test-eval"].includes(id)) return [...base, "Reading her labs and when they were drawn", "Checking each test against guidelines", "Timing it to her predicted cycle"];
  if (["condition", "knowledge", "specialty"].includes(id)) return [...base, "Searching the specialty guides", "Attaching sources"];
  return [...base, "Gathering grounded context"];
}

/** Contextual prompt suggestions for whichever section is in view. */
export function suggestionsFor(section: string): string[] {
  const plat = platformSuggestions(section);
  if (plat) return plat;
  const map: Record<string, string[]> = {
    hero: ["What is OVEREO?", "Why is she so tired?", "Show me her Ovarian Clock"],
    si: ["What can you do?", "Night mood", "Enter space"],
    gap: ["Why are women diagnosed later?", "Tell me about endometriosis", "Why do women get more drug side effects?"],
    converge: ["What data do you read?", "What does skin temperature show?", "Show me her next period"],
    clock: ["Explain her Ovarian Clock", "What does AMH 1.3 mean?", "Should she think about egg freezing?"],
    lens: ["Which phase is she in?", "When is her next period?", "Why does sleep drop before her period?"],
    radar: ["Is this endometriosis?", "Why is she so tired?", "Print dossier"],
    futures: ["What if she starts strength training?", "What happens after menopause?", "Simulate iron treatment"],
    agent: ["Book what she needs", "Who will see her results?", "What will the agent do?"],
    ecosystem: ["Who is in the ecosystem?", "What does NEYU do?", "How does BioAro fit in?"],
    commons: ["How do I contribute to research?", "Is my data shared?", "Show me the map"],
    privacy: ["How is genetic data handled?", "Who sees my data?", "Can I delete everything?"],
    app: ["What will the app do?", "What will the OVEREO film show?", "Enter space"],
    labs: ["What is menstrual-fluid testing?", "Can ovarian ageing be slowed?", "What's coming by 2035?"],
    join: ["What happens when I join?", "Do you need my health data?", "What is OVEREO?"],
  };
  return map[section] ?? map.hero;
}
