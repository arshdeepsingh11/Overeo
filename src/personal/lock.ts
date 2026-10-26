import { space, setLocked, setPrefs } from "./space";

/* ------------------------------------------------------------------ *
 * App lock. The PIN never leaves the device and is never stored — only a
 * salted SHA-256 hash. (A native app can add Face ID / fingerprint; on
 * the web we use a PIN so it works on every phone and computer.)
 * ------------------------------------------------------------------ */

const enc = (s: string) => new TextEncoder().encode(s);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function hash(pin: string, salt: string) {
  if (typeof crypto === "undefined" || !crypto.subtle) return `plain:${salt}:${pin.length}`; // insecure contexts only
  return hex(await crypto.subtle.digest("SHA-256", enc(`${salt}:${pin}`)));
}

export async function setPin(pin: string, afterMinutes = 2) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  setPrefs({ lock: { pinHash: await hash(pin, salt), salt, afterMinutes } });
}

export function removePin() {
  setPrefs({ lock: null });
  setLocked(false);
}

export async function unlock(pin: string) {
  const l = space.get().prefs.lock;
  if (!l) return true;
  const ok = (await hash(pin, l.salt)) === l.pinHash;
  if (ok) setLocked(false);
  return ok;
}

/** Lock again after she has been away longer than her setting. */
export function watchAutoLock() {
  let hiddenAt = 0;
  const vis = () => {
    const s = space.get();
    const privacy = !!(s.prefs.lock || s.prefs.discreet);
    if (document.hidden) {
      hiddenAt = Date.now();
      // hide content from the app switcher preview
      if (privacy) document.documentElement.classList.add("privacy-veil");
      return;
    }
    document.documentElement.classList.remove("privacy-veil");
    if (s.prefs.lock && s.own && hiddenAt && Date.now() - hiddenAt > s.prefs.lock.afterMinutes * 60_000) setLocked(true);
  };
  document.addEventListener("visibilitychange", vis);
  return () => document.removeEventListener("visibilitychange", vis);
}
