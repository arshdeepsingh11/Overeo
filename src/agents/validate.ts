import { checkText, numbersIn } from "../personal/mind/live";

/* =====================================================================
   The validator (ORA's rules, in code).

   - Every number, percentage, date or amount in an answer must appear in
     the context she was given (OVEREO passages + her facts) or in her
     own question. Anything else is an unverified figure.
   - Doses, diagnoses and other-assistant names are never allowed.
   For team runs, ORA removes the sentences that fail and reports them.
   ===================================================================== */

export interface Check {
  ok: boolean;
  unverified: number[];
  banned: string | null;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 || (b !== 0 && Math.abs(a - b) / Math.abs(b) < 1e-6);

/** Tiny counts ("2 questions", "1 step") aren't claims. */
const trivial = (n: number) => Number.isInteger(n) && n >= 0 && n <= 3;

export function checkAnswer(answer: string, context: string): Check {
  const known = numbersIn(context);
  const unverified = [...new Set(numbersIn(answer))].filter((n) => !trivial(n) && !known.some((k) => near(k, n)));
  const banned = checkText(answer);
  return { ok: !unverified.length && !banned, unverified, banned: banned === "empty" ? null : banned };
}

/** Split into sentences, keeping bullets as their own lines. */
export function sentences(t: string): string[] {
  return t
    .split(/\n+/)
    .flatMap((line) => (/^\s*[-•*]\s/.test(line) ? [line.trim()] : line.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)))
    .map((x) => x.trim())
    .filter(Boolean);
}

/** ORA: keep only what the context supports. */
export function verifyNotes(notes: string, context: string): { kept: string; removed: string[] } {
  const kept: string[] = [];
  const removed: string[] = [];
  for (const s of sentences(notes)) {
    const c = checkAnswer(s, context);
    if (c.unverified.length || (c.banned && c.banned !== "empty")) removed.push(s);
    else kept.push(s);
  }
  return { kept: kept.join(" ").replace(/\s+([-•*]\s)/g, "\n$1"), removed };
}
