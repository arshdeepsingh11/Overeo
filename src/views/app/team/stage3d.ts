import * as THREE from "three";
import type { Shape } from "../../../agents/team";
import type { CharState } from "./Character";

/* =====================================================================
   3D stage for the agent team — ONE WebGL context for every character.

   Each agent is a small glass-and-pearl 3D creature with its own design.
   The single renderer draws each visible agent in turn and copies the
   frame into that agent's own 2D canvas, so any number of characters
   cost one GPU context, keep normal page stacking (modals stay on top),
   and pause when off-screen. ~30 fps, still frames for reduced motion.
   ===================================================================== */

export interface View {
  el: HTMLCanvasElement;
  shape: Shape;
  hue: number;
  state: CharState;
  visible: boolean;
  seed: number;
}

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  eyes: THREE.Mesh[];
  mouth: THREE.Mesh;
  halo: THREE.Object3D;
  extra: THREE.Object3D[];
  orbit: THREE.Group;
  mats: THREE.MeshPhysicalMaterial[];
}

let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
const rigs = new Map<string, Rig>();
const views = new Set<View>();
let raf = 0;
let last = 0;
let failed = false;
const reduce = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A soft studio light-box for reflections (no extra files needed). */
function environment(r: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x2a2030, side: THREE.BackSide }));
  env.add(box);
  const panel = (w: number, h: number, c: number, p: [number, number, number], r2: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(...p);
    m.rotation.set(...r2);
    env.add(m);
  };
  panel(6, 3, 0xffffff, [0, 4.6, 0], [Math.PI / 2, 0, 0]);
  panel(3, 4, 0xffd6ea, [-4.6, 1, 1], [0, Math.PI / 2, 0]);
  panel(3, 4, 0xd6e8ff, [4.6, 1, 1], [0, -Math.PI / 2, 0]);
  panel(4, 2, 0xffffff, [0, 1, 4.6], [0, Math.PI, 0]);
  const pm = new THREE.PMREMGenerator(r);
  const tex = pm.fromScene(env, 0.04).texture;
  pm.dispose();
  return tex;
}

function init() {
  if (renderer || failed) return !!renderer;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(256, 256, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    scene.environment = environment(renderer);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.1, 6.9);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x553355, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc2e2, 1.1);
    rim.position.set(-3, 1, -3);
    scene.add(rim);
    return true;
  } catch {
    failed = true;
    renderer = null;
    return false;
  }
}

const pearl = (hue: number, light = 0.68, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(hue / 360, 0.72, light - 0.03),
    roughness: 0.18,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 0.75,
    iridescenceIOR: 1.35,
    sheen: 0.6,
    sheenColor: new THREE.Color().setHSL(((hue + 40) % 360) / 360, 0.9, 0.85),
    emissive: new THREE.Color().setHSL(hue / 360, 0.8, 0.18),
    emissiveIntensity: 0.35,
    ...extra,
  });

const glow = (hue: number) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.9, 0.82), emissive: new THREE.Color().setHSL(hue / 360, 0.95, 0.6), emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.85 });

function extruded(points: [number, number][], depth: number, mat: THREE.Material, bevel = 0.06) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 18 });
  g.center();
  return new THREE.Mesh(g, mat);
}

function starPoints(r1: number, r2: number, n = 5): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

function build(shape: Shape, hue: number): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const main = pearl(hue);
  const accent = pearl((hue + 25) % 360, 0.78);
  const mats = [main, accent];
  const extra: THREE.Object3D[] = [];
  let core: THREE.Mesh;
  switch (shape) {
    case "moon":
      core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), main);
      {
        const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.12, 16, 48, Math.PI * 1.25), accent);
        crescent.position.set(0.95, 0.95, 0.1);
        crescent.rotation.z = -0.6;
        extra.push(crescent);
      }
      break;
    case "flask":
      core = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            [0.0, -1.05],
            [0.9, -0.95],
            [1.02, -0.55],
            [0.78, 0.05],
            [0.36, 0.45],
            [0.34, 0.95],
            [0.44, 1.05],
            [0.0, 1.05],
          ].map(([x, y]) => new THREE.Vector2(x, y)),
          48,
        ),
        main,
      );
      {
        const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.74, 32, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), glow((hue + 15) % 360));
        liquid.position.y = -0.35;
        extra.push(liquid);
      }
      break;
    case "leaf":
      core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), main);
      core.scale.set(0.86, 1.14, 0.86);
      {
        const leaf = extruded(
          [
            [0, 0],
            [0.25, 0.25],
            [0.1, 0.7],
            [0, 0.8],
            [-0.1, 0.7],
            [-0.25, 0.25],
          ],
          0.06,
          accent,
          0.03,
        );
        leaf.position.set(0.15, 1.35, 0);
        leaf.rotation.z = -0.4;
        extra.push(leaf);
      }
      break;
    case "bird":
      core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), main);
      core.scale.set(1, 0.92, 0.95);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), accent);
        wing.scale.set(0.35, 0.8, 0.6);
        wing.position.set(side * 1.0, -0.05, -0.1);
        wing.userData.wing = side;
        extra.push(wing);
      }
      {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 16), accent);
        tuft.position.set(0, 1.05, 0);
        extra.push(tuft);
      }
      break;
    case "hex":
      core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.08, 1), main);
      main.flatShading = true;
      main.needsUpdate = true;
      break;
    case "star":
      core = new THREE.Mesh(new THREE.SphereGeometry(0.95, 48, 32), main);
      {
        const star = extruded(starPoints(0.42, 0.18), 0.12, glow((hue + 30) % 360), 0.05);
        star.position.set(0, 1.35, 0);
        star.userData.spin = true;
        extra.push(star);
      }
      break;
    case "flower":
      core = new THREE.Mesh(new THREE.SphereGeometry(0.88, 48, 32), main);
      for (let i = 0; i < 6; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), accent);
        const a = (i / 6) * Math.PI * 2;
        petal.scale.set(0.7, 1.15, 0.35);
        petal.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, -0.35);
        petal.rotation.z = a - Math.PI / 2;
        extra.push(petal);
      }
      break;
    case "wave":
      core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.62), main);
      core.position.y = -0.25;
      core.scale.set(1.05, 1.2, 1.05);
      {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.1, 16, 64), accent);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.38;
        extra.push(ring);
      }
      break;
    case "shield":
      core = extruded(
        [
          [0, 1.1],
          [0.95, 0.75],
          [0.85, -0.2],
          [0, -1.15],
          [-0.85, -0.2],
          [-0.95, 0.75],
        ],
        0.55,
        main,
        0.14,
      );
      break;
    case "echo":
      core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), main);
      core.scale.set(1.05, 0.95, 0.95);
      // sound waves on both sides: one voice in, another language out
      for (const side of [-1, 1])
        for (const k of [0, 1]) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42 + k * 0.28, 0.05, 12, 40, Math.PI * 0.7), k ? glow((hue + 30) % 360) : accent);
          arc.rotation.z = side > 0 ? -Math.PI * 0.35 : Math.PI * 0.65;
          arc.position.set(side * (0.95 + k * 0.05), 0.05, 0);
          arc.userData.wave = k + 1;
          extra.push(arc);
        }
      break;
    case "orb":
    default:
      core = new THREE.Mesh(new THREE.SphereGeometry(0.95, 48, 32), main);
      for (const t of [0.5, -0.7]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.03, 8, 96), glow((hue + 40) % 360));
        r.rotation.set(Math.PI / 2 + t, t, 0);
        r.userData.ringSpin = t;
        extra.push(r);
      }
  }
  body.add(core);
  extra.forEach((e) => body.add(e));

  // face — dark glossy eyes with a highlight, and a small mouth
  const faceZ = shape === "shield" ? 0.42 : shape === "hex" ? 0.98 : shape === "flower" ? 0.86 : 0.93;
  const faceY = shape === "wave" ? 0.05 : shape === "flask" ? -0.35 : 0.05;
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x1d1424, roughness: 0.05, clearcoat: 1 });
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), eyeMat);
    e.scale.set(1, 1.25, 0.6);
    e.position.set(s * 0.3, faceY + 0.08, faceZ);
    e.userData.y0 = e.position.y;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    spark.position.set(0.04, 0.05, 0.1);
    e.add(spark);
    body.add(e);
    return e;
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 8, 24, Math.PI), eyeMat);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, faceY - 0.2, faceZ - 0.02);
  body.add(mouth);
  for (const s of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(((hue + 350) % 360) / 360, 0.9, 0.75), transparent: true, opacity: 0.5 }));
    blush.position.set(s * 0.5, faceY - 0.12, faceZ - 0.05);
    body.add(blush);
  }

  // futuristic halo + thinking orbit
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.012, 6, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.9, 0.75), transparent: true, opacity: 0.55 }));
  halo.rotation.x = Math.PI / 2.4;
  root.add(halo);
  const orbit = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glow((hue + 20) % 360));
    const a = (i / 3) * Math.PI * 2;
    d.position.set(Math.cos(a) * 1.5, 0.2, Math.sin(a) * 1.5);
    orbit.add(d);
  }
  orbit.visible = false;
  root.add(orbit);
  return { root, body, eyes, mouth, halo, extra, orbit, mats };
}

function rigFor(shape: Shape, hue: number) {
  const k = `${shape}:${hue}`;
  let r = rigs.get(k);
  if (!r) {
    r = build(shape, hue);
    r.root.visible = false;
    scene.add(r.root);
    rigs.set(k, r);
  }
  return r;
}

function pose(r: Rig, v: View, t: number) {
  const s = v.state;
  const k = t + v.seed;
  r.root.visible = true;
  // idle: float and turn gently toward her
  r.body.position.y = Math.sin(k * 1.6) * 0.06;
  r.body.rotation.y = Math.sin(k * 0.6) * 0.32;
  r.body.rotation.z = 0;
  r.body.scale.setScalar(1);
  r.halo.rotation.z = k * 0.4;
  r.orbit.visible = false;
  // blink every ~4 s
  const blink = (k % 4.2) > 4.05 ? 0.15 : 1;
  r.eyes.forEach((e) => (e.scale.y = 1.25 * blink));
  r.mouth.scale.set(1, 1, 1);
  r.mouth.rotation.z = Math.PI;
  if (s === "listening") r.body.rotation.z = Math.sin(k * 1.2) * 0.12;
  if (s === "thinking") {
    r.body.position.y = Math.sin(k * 4) * 0.08;
    r.body.rotation.y = Math.sin(k * 1.5) * 0.5;
    r.orbit.visible = true;
    r.orbit.rotation.y = k * 2.4;
    r.halo.rotation.z = k * 2;
    r.eyes.forEach((e) => (e.position.y = e.userData.y0 + 0.07));
  } else r.eyes.forEach((e) => (e.position.y = e.userData.y0));
  if (s === "speaking") {
    r.mouth.scale.set(1, 1 + Math.abs(Math.sin(k * 14)) * 1.6, 1);
    r.body.scale.setScalar(1 + Math.abs(Math.sin(k * 7)) * 0.025);
  }
  if (s === "done") {
    r.mouth.rotation.z = Math.PI;
    r.mouth.scale.set(1.25, 1.25, 1);
  }
  if (s === "handoff") r.body.position.y = Math.abs(Math.sin(k * 6)) * 0.25;
  for (const e of r.extra) {
    if (e.userData.wing) e.rotation.z = Math.sin(k * (s === "thinking" ? 14 : 3)) * 0.35 * e.userData.wing;
    if (e.userData.spin) e.rotation.y = k * 1.5;
    if (e.userData.wave) e.scale.setScalar(1 + Math.max(0, Math.sin(k * (s === "speaking" ? 9 : 3) - e.userData.wave)) * 0.12);
    if (e.userData.ringSpin !== undefined) e.rotation.z = k * (0.6 + e.userData.ringSpin);
  }
  const dim = s === "waiting" ? 0.35 : 1;
  r.mats.forEach((m) => (m.emissiveIntensity = 0.35 * dim));
}

let turn = 0;
/**
 * Draw visible characters, within a small time budget per frame: with
 * many on screen (Why OVEREO shows 20), each one updates a little less
 * often instead of slowing the page down. Phones stay smooth.
 */
function draw(t: number, all = false) {
  if (!renderer) return;
  const list = [...views].filter((v) => v.visible && v.el.width && v.el.height);
  if (!list.length) return;
  const start = performance.now();
  for (let k = 0; k < list.length; k++) {
    const v = list[(turn + k) % list.length];
    const r = rigFor(v.shape, v.hue);
    rigs.forEach((x) => (x.root.visible = false));
    pose(r, v, t);
    renderer.render(scene, camera);
    const g = v.el.getContext("2d");
    if (g) {
      g.clearRect(0, 0, v.el.width, v.el.height);
      g.drawImage(renderer.domElement, 0, 0, v.el.width, v.el.height);
      if (!v.el.dataset.drawn) v.el.dataset.drawn = "1";
    }
    if (!all && performance.now() - start > 8) {
      turn = (turn + k + 1) % list.length;
      return;
    }
  }
}

function loop(now: number) {
  raf = 0;
  if (![...views].some((v) => v.visible)) return;
  if (now - last > 33) {
    last = now;
    draw(now / 1000);
  }
  if (!reduce()) raf = requestAnimationFrame(loop);
}

function kick() {
  if (!raf) raf = requestAnimationFrame(loop);
}

export function register(v: View): (() => void) | null {
  if (!init()) return null;
  views.add(v);
  const io = new IntersectionObserver(([e]) => {
    v.visible = e.isIntersecting;
    if (v.visible) kick();
  });
  io.observe(v.el);
  kick();
  return () => {
    io.disconnect();
    views.delete(v);
  };
}

export function update(v: View) {
  // a still frame is enough when motion is reduced; otherwise the loop picks it up
  if (reduce()) {
    if (v.visible) draw(performance.now() / 1000, true);
  } else kick();
}

export const webglOk = () => {
  if (failed) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};
