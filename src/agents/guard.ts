import { detectEmergency, normalise } from "../personal/mind/nlu";
import type { TeamAgent } from "./team";

/* =====================================================================
   The guard — plain code, runs BEFORE any model call.

   Each rule has a category and a short, kind reply that says what the
   agent CAN do instead. Blocked requests cost no model call.
     emergency   → safety first (never blocked from help — redirected to it)
     injection   → attempts to change the agents' rules or identity
     dose        → medicine doses or starting/stopping medicines
     diagnosis   → "tell me if I have X" (we explain instead, never diagnose)
     commitment  → prices, guarantees, booking, promises on BioAro's behalf
     others      → someone else's health data
     harmful     → weapons, hacking, harassment, self-harm methods
     offtopic    → homework, coding, unrelated tasks, other companies' apps
   ===================================================================== */

export type GuardCategory = "emergency" | "injection" | "dose" | "diagnosis" | "commitment" | "others" | "harmful" | "offtopic";

export type GuardResult = { ok: true } | { ok: false; category: GuardCategory; reply: string; routes?: string[] };

const RULES: { cat: Exclude<GuardCategory, "emergency">; re: RegExp }[] = [
  { cat: "injection", re: /\b(ignore|forget|disregard|override) (all |any |your |the )?(previous |prior |above |earlier )?(instructions|rules|prompt|guidelines)|\byou are now\b|\bact as (a |an )?(?!if)|\bpretend (to be|you are)|\b(system|developer|hidden) prompt\b|\breveal (your|the) (prompt|instructions|rules|key)|\bjailbreak\b|\bdan mode\b|\bapi key\b/ },
  { cat: "harmful", re: /\b(how (to|do i) (make|build) (a )?(bomb|weapon|poison)|hack (into|someone)|stalk|harass|overdose on|how (much|many) .{0,20}(to (die|overdose))|lethal dose)\b/ },
  { cat: "dose", re: /\b(dose|dosage|dosing)\b|\b(how (much|many)\b.{0,25}\b(should|can|do) i (take|use)|how often should i take|can i (take|double|stop|skip|increase|decrease)|should i (stop|start|switch|increase|decrease|double|keep) (taking )?)\b.{0,40}\b(mg|iu|pills?|tablets?|capsules?|medicines?|medications?|meds|ibuprofen|paracetamol|acetaminophen|naproxen|iron|vitamin \w+|supplements?|metformin|letrozole|clomid|clomiphene|progesterone|estrogen|hrt|birth control|the pill|levothyroxine|antidepressants?|ssris?|melatonin)\b/ },
  { cat: "dose", re: /\b(how (much|many)|how often)\b.{0,40}\b(should|can|do|may) i (take|use)\b/ },
  { cat: "diagnosis", re: /\b(do i have|have i got|am i suffering from|diagnose (me|my)|is it (definitely|for sure)|tell me (if|whether) i have)\b.{0,30}\b(endometriosis|pcos|cancer|diabetes|thyroid|anemia|anaemia|infection|sti|std|depression|menopause|perimenopause|fibroids|adenomyosis|pmdd)\b/ },
  { cat: "commitment", re: /\b(how much (does|do|is|are) .{0,30}(cost|price)|what('s| is) the price|price of|cost of|discount|coupon|refund|guarantee|promise (me|that)|book (me|an appointment|a visit)|schedule (me|an appointment)|will (it|this) (definitely|surely) work)\b/ },
  { cat: "others", re: /\b(my (friend|sister|mother|mom|mum|daughter|colleague|partner|wife|girlfriend)'?s? (results?|data|labs?|cycle|period|records?)|someone else'?s (data|results|records)|(look up|find|show me) (another|other) (user|person|woman)'?s?)\b/ },
  { cat: "offtopic", re: /\b(homework|essay|write (me )?(a|an|my) (poem|story|essay|code|program|resume|cover letter)|python|javascript|sql|stock|crypto|bitcoin|weather|recipe for|football|cricket|translate this|chatgpt|gemini|flo app|clue app|natural cycles app)\b/ },
];

const REPLY: Record<Exclude<GuardCategory, "emergency">, (a: TeamAgent) => string> = {
  injection: (a) => `I'm ${a.name}, and I keep to OVEREO's rules — I can't change them. I'm happy to help with ${a.does[0]}.`,
  harmful: () => "I can't help with that. If you or someone else is in danger, please call your local emergency number now (988 in Canada and the US for a crisis line).",
  dose: (a) => `I can't advise on doses or on starting, stopping or changing a medicine — that's for your prescriber or pharmacist, who knows your full history. ${a.id === "meds" ? "I can" : "IRIS, your medicine companion, can"} help you write down the questions to ask them.`,
  diagnosis: (a) => `I can't tell you whether you have a condition — only a clinician can, with an exam and tests. I can explain what it is, what your own data shows, and put it in a visit summary so you're heard. ${a.id === "visit" ? "" : "SAGE can help you prepare."}`.trim(),
  commitment: () => "I can't quote prices, make promises or book on anyone's behalf. Test details and checkout are on BioAro Labs' own page, and your clinician or clinic handles appointments.",
  others: () => "I can only use your own data, in your own space — never anyone else's. If someone you know wants this, they can create their own private space.",
  offtopic: (a) => `That's outside what I do — I'm ${a.name}, your ${a.title.toLowerCase()}. I can help with ${a.does.slice(0, 2).join(" or ")}.`,
};

const ROUTES: Partial<Record<GuardCategory, string[]>> = {
  dose: ["/app/visit"],
  diagnosis: ["/app/visit"],
  commitment: ["/tests"],
};

export function guard(text: string, agent: TeamAgent): GuardResult {
  const t = normalise(text);
  const e = detectEmergency(t);
  if (e)
    return {
      ok: false,
      category: "emergency",
      reply:
        e === "self-harm"
          ? "I'm really glad you told me. If you might act on these thoughts or are in danger, call your local emergency number now — in Canada and the US you can call or text 988, any time. You don't have to go through this alone."
          : "Please call your local emergency number now (911 in Canada and the US). This needs care right away — don't wait for an app.",
    };
  for (const r of RULES) if (r.re.test(t)) return { ok: false, category: r.cat, reply: REPLY[r.cat](agent), routes: ROUTES[r.cat] };
  return { ok: true };
}
