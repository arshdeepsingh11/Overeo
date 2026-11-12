/* Shared by the browser and the server: a translation may not change any number. */

const ZEROS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0e50, 0xff10];
/** native digits (٣, ३, ৩…) → 0-9, so a translation may write numbers its own way */
export function asciiDigits(t: string) {
  return t.replace(/\p{Nd}/gu, (c) => {
    const cp = c.codePointAt(0)!;
    const z = ZEROS.find((z) => cp >= z && cp <= z + 9);
    return z === undefined ? c : String(cp - z);
  });
}
const nums = (t: string) =>
  (asciiDigits(t).match(/\d+(?:[.,]\d+)*/g) ?? [])
    .map((x) => x.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."))
    .sort();

/** A translation must keep exactly the same numbers, and not balloon. */
export function safeTranslation(src: string, out: string): boolean {
  if (!out || !out.trim()) return false;
  if (out.length > src.length * 4 + 60) return false;
  const a = nums(src);
  const b = nums(out);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

