import * as THREE from "three";
import type { CharState } from "./Character";
import { buildBot, contactShadow, lights, pose, studio, type Bot } from "./bots3d";

/* =====================================================================
   OVEREO agents — the 3D stage.

   ONE WebGL context draws every character on the page in turn and copies
   each frame into that character's own 2D canvas, so any number of
   agents cost one GPU context.

   frame "full" shows her whole body (the chat stage, the team line-up);
   "bust" shows head and shoulders (chips, cards). A "still" view is drawn
   once and only redrawn when her state changes (old messages in a chat).

   A governor watches the frame cost: on slow devices characters update
   less often, and if the device can't keep up at all they fall back to
   the light SVG versions. Off-screen characters, hidden tabs and anything
   behind an open dialog don't render.

   Motion: characters always breathe, blink and look around. When the
   device asks for reduced motion they do it slowly and gently (no hops,
   no big gestures). "Lighter animations" in Me turns 3D off completely.
   ===================================================================== */

export interface View {
  el: HTMLCanvasElement;
  /** agent id (cycle, labs, … echo, ora, si) */
  agent: string;
  hue: number;
  state: CharState;
  frame: "full" | "bust";
  /** draw once per state change, not every frame */
  still?: boolean;
  visible: boolean;
  seed: number;
  /** called if the device is too slow for 3D (show the SVG instead) */
  onFallback?: () => void;
  last?: number;
  drawnState?: CharState;
}

const SIZE = 512; // the shared drawing buffer (each view uses a part of it)

let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let shadow: THREE.Mesh;
const bots = new Map<string, Bot>();
const views = new Set<View>();
let raf = 0;
let failed = false;
const reduce = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let pointer = { x: 0, y: 0 };

function init() {
  if (renderer || failed) return !!renderer;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setScissorTest(true);
    scene = new THREE.Scene();
    scene.environment = studio(renderer);
    scene.environmentIntensity = 0.75;
    lights(scene);
    shadow = contactShadow();
    scene.add(shadow);
    camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    addEventListener("pointermove", (e) => (pointer = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 }), { passive: true });
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && kick());
    return true;
  } catch {
    failed = true;
    renderer = null;
    return false;
  }
}

function botFor(v: Pick<View, "agent" | "hue">) {
  const key = `${v.agent}:${v.hue}`;
  let b = bots.get(key);
  if (!b) {
    b = buildBot(v.agent, v.hue);
    bots.set(key, b);
    scene.add(b.root);
  }
  return b;
}

/** point the camera at her: whole body, or head and shoulders */
function frameCam(b: Bot, frame: View["frame"], aspect: number) {
  camera.aspect = aspect;
  const half = THREE.MathUtils.degToRad(camera.fov / 2);
  let cy: number, vis: number;
  if (frame === "full") {
    cy = (b.height + b.float) / 2 + 0.02;
    vis = (b.height + b.float) * 1.12;
  } else {
    cy = b.headY + b.float * 0.75 - b.bustH * 0.1;
    vis = b.bustH;
  }
  // fit the height, and the width on narrow canvases
  const needH = Math.max(vis, (vis * 0.62) / aspect);
  const dist = needH / 2 / Math.tan(half);
  camera.position.set(0, cy + dist * 0.06, dist);
  camera.lookAt(0, cy, 0);
  camera.updateProjectionMatrix();
}

function render(v: View, now: number) {
  const b = botFor(v);
  bots.forEach((x) => (x.root.visible = x === b));
  const calm = reduce();
  pose(b, v.state, now / 1000, v.seed, v.still ? { x: 0, y: 0 } : pointer, calm);
  shadow.visible = v.frame === "full";
  shadow.scale.setScalar(1 - Math.min(0.5, b.root.position.y * 1.2));
  (shadow.material as THREE.MeshBasicMaterial).opacity = 1 - Math.min(0.6, b.root.position.y * 2);
  const w = v.el.width, h = v.el.height;
  const sc = Math.min(1, SIZE / w, SIZE / h);
  const rw = Math.max(1, Math.round(w * sc)), rh = Math.max(1, Math.round(h * sc));
  renderer!.setViewport(0, 0, rw, rh);
  renderer!.setScissor(0, 0, rw, rh);
  frameCam(b, v.frame, rw / rh);
  renderer!.render(scene, camera);
  const g = v.el.getContext("2d");
  if (g) {
    g.clearRect(0, 0, w, h);
    g.drawImage(renderer!.domElement, 0, SIZE - rh, rw, rh, 0, 0, w, h);
    if (!v.el.dataset.drawn) v.el.dataset.drawn = "1";
    v.el.dataset.agent = v.agent;
    v.el.dataset.state = v.state;
  }
  v.drawnState = v.state;
}

/* ------------------------- governor + draw loop ------------------------- */

let cost = 0; // average ms per character frame
let frames = 0;
let turn = 0;
/** ms between updates of one character: the big stage moves smoothly, small ones calmly */
const interval = (v: View) => {
  const busy = v.state === "thinking" || v.state === "speaking" || v.state === "handoff" || v.state === "listening";
  const base = (v.frame === "full" && v.el.height >= 300) || busy ? 16 : 40;
  const calm = reduce() ? 2 : 1;
  // slow device: update less often
  return base * calm * (cost > 10 ? 3 : cost > 5 ? 1.7 : 1);
};

function giveUp() {
  failed = true;
  for (const v of views) v.onFallback?.();
  views.clear();
  bots.forEach((b) => scene.remove(b.root));
  bots.clear();
  renderer?.dispose();
  renderer = null;
}

const modalOk = (v: View) => {
  // while a sheet or dialog is open, characters behind it rest
  const modals = document.querySelectorAll('[aria-modal="true"]');
  if (!modals.length) return true;
  return modals[modals.length - 1].contains(v.el);
};

function draw(now: number, all = false) {
  if (!renderer) return;
  const list = [...views].filter((v) => v.visible && v.el.width && v.el.height && v.el.isConnected && modalOk(v));
  if (!list.length) return;
  const start = performance.now();
  for (let k = 0; k < list.length; k++) {
    const v = list[(turn + k) % list.length];
    if (v.still && v.drawnState === v.state && !all) continue;
    if (!all && !v.still && v.last && now - v.last < interval(v)) continue;
    v.last = now;
    const t1 = performance.now();
    render(v, now);
    const dt = performance.now() - t1;
    frames++;
    // the first frames include compiling shaders — don't judge the device on those
    if (frames > 4) cost = frames === 5 ? dt : cost * 0.85 + dt * 0.15;
    // a device without real graphics power gets the light versions
    if (frames > 20 && cost > 28) return giveUp();
    if (!all && performance.now() - start > 8) {
      turn = (turn + k + 1) % list.length;
      return;
    }
  }
}

function loop(now: number) {
  raf = 0;
  if (!renderer || document.visibilityState === "hidden") return;
  const live = [...views].filter((v) => v.visible && !v.still && v.el.isConnected);
  draw(now);
  if (!live.length) return;
  if (!live.some(modalOk)) {
    // everything is behind a dialog: check again calmly
    setTimeout(kick, 400);
    return;
  }
  raf = requestAnimationFrame(loop);
}

function kick() {
  if (!raf && renderer) raf = requestAnimationFrame(loop);
}

/** Once per page: can this device draw a character quickly? If not, use the light versions from the start. */
let probed = false;
function probe() {
  if (probed || !renderer) return !!renderer;
  probed = true;
  try {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 260;
    const v: View = { el: c, agent: "si", hue: 322, state: "idle", frame: "full", visible: true, seed: 0 };
    render(v, 0); // includes compiling the shaders
    const t = performance.now();
    for (let i = 0; i < 3; i++) render(v, i * 100);
    renderer.getContext().finish();
    const per = (performance.now() - t) / 3;
    if (per > 24) {
      giveUp();
      return false;
    }
    cost = per;
    return true;
  } catch {
    giveUp();
    return false;
  }
}

export function register(v: View): (() => void) | null {
  if (!init() || !probe()) return null;
  views.add(v);
  const io = new IntersectionObserver(([e]) => {
    v.visible = e.isIntersecting;
    if (v.visible) {
      if (v.still) draw(performance.now(), false);
      kick();
    }
  });
  io.observe(v.el);
  // first frame right away, so she never appears blank
  try {
    render(v, performance.now());
  } catch {}
  kick();
  return () => {
    io.disconnect();
    views.delete(v);
  };
}

export function update(v: View) {
  v.last = 0;
  if (v.still) {
    if (renderer && v.el.isConnected) render(v, performance.now());
    return;
  }
  kick();
}

/** warm up a character before she is needed (so a hand-over is instant) */
export function prepareAgent(agent: string, hue: number) {
  if (!init() || failed) return;
  try {
    botFor({ agent, hue });
  } catch {}
}

// checked once: creating a WebGL context is expensive (and browsers allow only a few)
let glSupport: boolean | null = null;
export const webglOk = () => {
  if (failed) return false;
  try {
    // "Lighter animations" in Me
    if (localStorage.getItem("overeo.lite") === "1") return false;
  } catch {}
  if (glSupport === null) {
    if (renderer) glSupport = true;
    else
      try {
        const c = document.createElement("canvas");
        const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
        glSupport = !!gl;
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        glSupport = false;
      }
  }
  return glSupport;
};
