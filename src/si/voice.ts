/* ------------------------------------------------------------------ *
 * Voice in (Web Speech recognition) and voice out (speech synthesis),
 * plus a live microphone level for the orb. Everything degrades
 * gracefully when a browser doesn't support it.
 * ------------------------------------------------------------------ */

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
const RecCtor = W.SpeechRecognition ?? W.webkitSpeechRecognition;

export const voiceSupported = !!RecCtor;
export const speakSupported = typeof window !== "undefined" && "speechSynthesis" in window;

export interface Listener {
  stop: () => void;
  abort: () => void;
}

export function listen(opts: {
  onPartial: (t: string) => void;
  onFinal: (t: string) => void;
  onEnd: () => void;
  onError: (msg: string) => void;
}): Listener | null {
  if (!RecCtor) {
    opts.onError("Voice input needs Chrome, Edge or Safari.");
    return null;
  }
  const r = new RecCtor();
  r.lang = navigator.language || "en-US";
  r.interimResults = true;
  r.continuous = false;
  let finalText = "";
  r.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    opts.onPartial((finalText + interim).trim());
  };
  r.onerror = (e) => opts.onError(e.error === "not-allowed" ? "Microphone permission was blocked." : `Voice error: ${e.error}`);
  r.onend = () => {
    if (finalText.trim()) opts.onFinal(finalText.trim());
    opts.onEnd();
  };
  try {
    r.start();
  } catch {
    opts.onError("Couldn't start voice input.");
    return null;
  }
  return { stop: () => r.stop(), abort: () => r.abort() };
}

let preferred: SpeechSynthesisVoice | null = null;
function pickVoice() {
  if (!speakSupported) return null;
  if (preferred) return preferred;
  const vs = speechSynthesis.getVoices();
  preferred =
    vs.find((v) => /Samantha|Ava|Allison|Google UK English Female|Microsoft Aria|Microsoft Jenny/i.test(v.name)) ??
    vs.find((v) => v.lang.startsWith((navigator.language || "en").slice(0, 2))) ??
    null;
  return preferred;
}
if (speakSupported) speechSynthesis.onvoiceschanged = () => (preferred = null);

export function speak(text: string, onBoundary?: () => void, onEnd?: () => void) {
  if (!speakSupported) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ""));
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.02;
  u.pitch = 1.02;
  u.onboundary = () => onBoundary?.();
  u.onend = () => onEnd?.();
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speakSupported) speechSynthesis.cancel();
}

/** Microphone level 0..1 for the orb (optional; asks permission). */
export async function micLevel(): Promise<{ read: () => number; close: () => void } | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new C();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    return {
      read: () => {
        an.getByteTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          s += v * v;
        }
        return Math.min(1, Math.sqrt(s / buf.length) * 4);
      },
      close: () => {
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      },
    };
  } catch {
    return null;
  }
}
