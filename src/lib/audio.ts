/* ------------------------------------------------------------------ *
 * Procedural UI sound (Web Audio). No audio files. Off until the user
 * interacts, and fully silent when "Sound" is toggled off.
 * ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let enabled = (() => {
  try {
    return localStorage.getItem("overeo.sound") !== "off";
  } catch {
    return true;
  }
})();

export const sound = {
  get enabled() {
    return enabled;
  },
  set(on: boolean) {
    enabled = on;
    try {
      localStorage.setItem("overeo.sound", on ? "on" : "off");
    } catch {}
  },
};

function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Soft glassy tick for micro-interactions. */
export function tick(freq = 1800, gain = 0.025) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, a.currentTime + 0.06);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.08);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.09);
}

/** Two-note chime used when Overeo SI opens. */
export function chime() {
  const a = ac();
  if (!a) return;
  [660, 990].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t0 = a.currentTime + i * 0.07;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.04, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + 0.55);
  });
}

/** Thermal printer: stepper-motor whine + paper buzz, for `seconds`. */
export function printerSound(seconds: number) {
  const a = ac();
  if (!a) return () => {};
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / a.sampleRate;
    const step = Math.sin(2 * Math.PI * 420 * t) > 0.6 ? 1 : 0; // stepper pulses
    const line = Math.sin(2 * Math.PI * 9 * t) > 0 ? 1 : 0.35; // line-by-line rhythm
    ch[i] = ((Math.random() * 2 - 1) * 0.35 + step * 0.4) * line * 0.18;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  bp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = 0.5;
  src.connect(bp).connect(g).connect(a.destination);
  src.start();
  return () => {
    try {
      src.stop();
    } catch {}
  };
}

/** Paper tear: a short filtered noise burst. */
export function tearSound() {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * 0.28);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.5 * (Math.random() > 0.7 ? 1 : 0.3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const g = a.createGain();
  g.gain.value = 0.35;
  src.connect(hp).connect(g).connect(a.destination);
  src.start();
}
