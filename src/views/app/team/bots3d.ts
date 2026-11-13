import * as THREE from "three";
import type { CharState } from "./Character";

/* =====================================================================
   OVEREO agents — the characters.

   Every agent has her own body, built in 3D from soft pearl shells,
   tinted parts in her colour, a dark glass visor and glowing eyes.
   Each one is shaped by her job, so you can tell them apart at a glance:

     LUNA  cycle guide       android with a crescent-moon halo and a
                              ring of 28 beads (her cycle) around her
     VERA  lab interpreter   flask-bodied lab bot with goggles, bubbles
     SAGE  care navigator    tall bot in a long coat, sprout, tablet
     PIP   reminder keeper   little round bird-bot with a bell
     IRIS  medicine companion capsule bot with hex eyes, orbiting chips
     NOOR  mood & sleep       floating cloud with sleepy eyes and stars
     BLOOM fertility planner  petal-skirt android holding a glowing seed
     MAEVE menopause coach    tall android, bob hair, flowing wave scarf
     ECHO  translator         globe head with headphones, sound-bar mouth
     ORA   verifier           sturdy guardian with a shield and scanner
     SI    presenter          glass-caped being, halo of the team's lights

   pose() animates every character the same way (breathing, blinking,
   looking at the pointer, arm gestures per state); each one adds her own
   touches in tick() (bubbles rise, wings flap, the scarf waves…).
   ===================================================================== */

export interface Bot {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  eyes: THREE.Object3D[];
  mouth: THREE.Object3D | null;
  glows: { m: THREE.MeshBasicMaterial; c: THREE.Color }[];
  spin: { o: THREE.Object3D; speed: number; axis: "x" | "y" | "z" }[];
  /** hover height (0 = stands on the floor) */
  float: number;
  height: number;
  headY: number;
  /** how much of her a head-and-shoulders view shows */
  bustH: number;
  tick?: (t: number, s: CharState, energy: number) => void;
}

/* -------------------------------- materials -------------------------------- */

const col = (h: number, s: number, l: number) => new THREE.Color().setHSL((((h % 360) + 360) % 360) / 360, s, l);

interface Mats {
  pearl: THREE.MeshPhysicalMaterial;
  tint: THREE.MeshPhysicalMaterial;
  soft: THREE.MeshPhysicalMaterial;
  deep: THREE.MeshPhysicalMaterial;
  visor: THREE.MeshPhysicalMaterial;
  metal: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  glow: () => THREE.MeshBasicMaterial;
  white: () => THREE.MeshBasicMaterial;
  gold: THREE.MeshPhysicalMaterial;
}

function mats(h: number, bot: { glows: Bot["glows"] }): Mats {
  const glowOf = (c: THREE.Color) => {
    const m = new THREE.MeshBasicMaterial({ color: c.clone(), toneMapped: false });
    bot.glows.push({ m, c: c.clone() });
    return m;
  };
  return {
    pearl: new THREE.MeshPhysicalMaterial({ color: col(h, 0.32, 0.94), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: col(h, 0.8, 0.85) }),
    tint: new THREE.MeshPhysicalMaterial({ color: col(h, 0.7, 0.62), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    soft: new THREE.MeshPhysicalMaterial({ color: col(h, 0.6, 0.8), roughness: 0.4, clearcoat: 0.6 }),
    deep: new THREE.MeshPhysicalMaterial({ color: col(h, 0.42, 0.4), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }),
    visor: new THREE.MeshPhysicalMaterial({ color: col(h + 240, 0.25, 0.09), roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 }),
    metal: new THREE.MeshStandardMaterial({ color: col(h, 0.12, 0.8), metalness: 0.85, roughness: 0.28 }),
    glass: new THREE.MeshPhysicalMaterial({ color: col(h, 0.55, 0.84), roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }),
    glow: () => glowOf(col(h, 1, 0.64)),
    white: () => glowOf(new THREE.Color(0xffffff)),
    gold: new THREE.MeshPhysicalMaterial({ color: col(42, 0.85, 0.62), metalness: 0.7, roughness: 0.25, clearcoat: 1 }),
  };
}

/* -------------------------------- geometry -------------------------------- */

const G = {
  sphere: (r: number, w = 40, h = 28) => new THREE.SphereGeometry(r, w, h),
  cap: (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 10, 24),
  cyl: (rt: number, rb: number, h: number, seg = 40, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  torus: (R: number, r: number, arc = Math.PI * 2, seg = 64) => new THREE.TorusGeometry(R, r, 14, seg, arc),
  cone: (r: number, h: number, seg = 32) => new THREE.ConeGeometry(r, h, seg),
  lathe: (pts: [number, number][], seg = 56) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg),
  rbox: (w: number, h: number, d: number, r: number) => {
    const s = new THREE.Shape();
    const x = -w / 2 + r, y = -h / 2 + r, iw = w - 2 * r, ih = h - 2 * r;
    s.moveTo(x, y - r);
    s.lineTo(x + iw, y - r);
    s.quadraticCurveTo(x + iw + r, y - r, x + iw + r, y);
    s.lineTo(x + iw + r, y + ih);
    s.quadraticCurveTo(x + iw + r, y + ih + r, x + iw, y + ih + r);
    s.lineTo(x, y + ih + r);
    s.quadraticCurveTo(x - r, y + ih + r, x - r, y + ih);
    s.lineTo(x - r, y);
    s.quadraticCurveTo(x - r, y - r, x, y - r);
    const bt = Math.min(r, d / 2);
    const depth = Math.max(0.001, d - 2 * bt);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: r * 0.98, bevelSegments: 6, curveSegments: 10 });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  },
  star: (ro: number, ri: number, n: number, depth: number) => {
    const s = new THREE.Shape();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? ri : ro;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.35, bevelSegments: 2 });
    g.center();
    return g;
  },
};

function mesh(g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], s?: [number, number, number], r?: [number, number, number]) {
  const o = new THREE.Mesh(g, m);
  if (p) o.position.set(...p);
  if (s) o.scale.set(...s);
  if (r) o.rotation.set(...r);
  return o;
}
function group(p?: [number, number, number], ...kids: THREE.Object3D[]) {
  const g = new THREE.Group();
  if (p) g.position.set(...p);
  kids.forEach((k) => g.add(k));
  return g;
}

/* ------------------------------- shared parts ------------------------------- */

type EyeKind = "dot" | "crescent" | "hex" | "sleepy" | "line" | "star" | "goggle";

/** a head: shell + dark glass visor + glowing eyes (+ a mouth light that shows when she speaks) */
function head(M: Mats, o: { r: number; sx?: number; sy?: number; eye: EyeKind; gap?: number; eyeY?: number; visor?: "band" | "face" | "none"; mouth?: boolean }) {
  const g = new THREE.Group();
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  g.add(mesh(G.sphere(o.r), M.pearl, [0, 0, 0], [sx, sy, 1]));
  const visor = o.visor ?? "face";
  if (visor !== "none") {
    const vg = visor === "band" ? new THREE.SphereGeometry(o.r * 1.015, 48, 24, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.36, Math.PI * 0.3) : new THREE.SphereGeometry(o.r * 1.012, 48, 32, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.28, Math.PI * 0.46);
    g.add(mesh(vg, M.visor, [0, 0, 0], [sx, sy, 1]));
  }
  const eyes: THREE.Object3D[] = [];
  const gap = (o.gap ?? 0.36) * o.r;
  const ey = (o.eyeY ?? 0.06) * o.r;
  const ez = Math.sqrt(Math.max(0, 1 - (gap / (o.r * sx)) ** 2 - (ey / (o.r * sy)) ** 2)) * o.r * 1.03;
  for (const side of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(side * gap, ey, ez);
    e.lookAt(side * gap * 2.2, ey * 1.6, ez * 3);
    const gm = M.glow();
    const k = o.r * 0.16;
    if (o.eye === "dot" || o.eye === "goggle") {
      e.add(mesh(G.sphere(k * 1.05, 24, 16), gm, [0, 0, 0], [1, 1.25, 0.35]));
      e.add(mesh(G.sphere(k * 0.32, 12, 8), M.white(), [k * 0.35, k * 0.45, k * 0.3], [1, 1, 0.4]));
      if (o.eye === "goggle") e.add(mesh(G.torus(k * 1.9, k * 0.32, Math.PI * 2, 40), M.metal, [0, 0, -k * 0.2]));
    } else if (o.eye === "crescent" || o.eye === "sleepy") {
      // happy arcs (crescent) or closed, content arcs (sleepy)
      e.add(mesh(G.torus(k * 1.0, k * 0.26, Math.PI, 24), gm, [0, o.eye === "sleepy" ? k * 0.4 : -k * 0.35, 0], [1, 1, 0.5], [0, 0, o.eye === "sleepy" ? Math.PI : 0]));
    } else if (o.eye === "hex") {
      e.add(mesh(G.cyl(k * 1.15, k * 1.15, k * 0.3, 6), gm, [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
    } else if (o.eye === "line") {
      e.add(mesh(G.cap(k * 0.32, k * 1.5), gm, [0, 0, 0], [1, 1, 0.5], [0, 0, Math.PI / 2]));
    } else if (o.eye === "star") {
      e.add(mesh(G.star(k * 1.35, k * 0.5, 4, k * 0.25), gm));
    }
    g.add(e);
    eyes.push(e);
  }
  let mouth: THREE.Object3D | null = null;
  if (o.mouth !== false) {
    const my = -0.32 * o.r;
    const mz = Math.sqrt(Math.max(0, 1 - (my / (o.r * sy)) ** 2)) * o.r * 1.03;
    mouth = mesh(G.cap(o.r * 0.045, o.r * 0.16), M.glow(), [0, my, mz], [1, 1, 0.5], [0, 0, Math.PI / 2]);
    mouth.scale.set(0.6, 0.6, 0.5);
    g.add(mouth);
  }
  return { g, eyes, mouth };
}

/** an arm hanging from the shoulder (pivot), hand at the end */
function arm(M: Mats, len: number, r: number, handR = r * 1.35, skin: THREE.Material = M.pearl) {
  const a = new THREE.Group();
  a.add(mesh(G.sphere(r * 1.15, 20, 14), M.metal));
  a.add(mesh(G.cap(r, len), skin, [0, -len / 2 - r * 0.4, 0]));
  a.add(mesh(G.sphere(handR, 24, 16), M.soft, [0, -len - r * 1.2, 0]));
  return a;
}
/** floating hands (no arm), for the hovering beings */
function hand(M: Mats, dist: number, r: number) {
  const a = new THREE.Group();
  a.add(mesh(G.sphere(r, 24, 16), M.soft, [0, -dist, 0], [1, 1.1, 0.9]));
  return a;
}

function base(): Pick<Bot, "glows" | "spin" | "eyes"> & { root: THREE.Group; body: THREE.Group } {
  return { glows: [], spin: [], eyes: [], root: new THREE.Group(), body: new THREE.Group() };
}

function finish(b: ReturnType<typeof base>, rest: Omit<Bot, "root" | "body" | "glows" | "spin" | "eyes"> & { eyes?: THREE.Object3D[] }): Bot {
  b.root.add(b.body);
  b.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
  });
  return { ...b, ...rest, eyes: rest.eyes ?? b.eyes };
}

/* --------------------------------- the team --------------------------------- */

function luna(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  // gown
  b.body.add(mesh(G.lathe([[0.001, 0.08], [0.42, 0.1], [0.5, 0.16], [0.47, 0.3], [0.38, 0.55], [0.27, 0.82], [0.2, 0.98], [0.001, 1.0]]), M.pearl));
  b.body.add(mesh(G.torus(0.395, 0.018), M.glow(), [0, 0.52, 0], undefined, [Math.PI / 2, 0, 0]));
  b.body.add(mesh(G.torus(0.47, 0.022), M.tint, [0, 0.27, 0], undefined, [Math.PI / 2, 0, 0]));
  // torso + crescent on her chest
  b.body.add(mesh(G.sphere(0.24), M.pearl, [0, 1.12, 0], [1, 1.25, 0.82]));
  b.body.add(mesh(G.torus(0.065, 0.016, Math.PI * 1.25), M.glow(), [0, 1.16, 0.19], undefined, [0, 0, -Math.PI * 0.35]));
  b.body.add(mesh(G.cyl(0.06, 0.07, 0.12), M.metal, [0, 1.4, 0]));
  const hd = head(M, { r: 0.27, sy: 1.08, eye: "crescent" });
  // sleek hair cap
  hd.g.add(mesh(new THREE.SphereGeometry(0.29, 48, 32, Math.PI * 0.68, Math.PI * 1.64, 0, Math.PI * 0.62), M.deep, [0, 0.02, -0.01], [1, 1.1, 1.03]));
  const headG = group([0, 1.66, 0], hd.g);
  // crescent-moon halo behind her head
  const moon = group([0, 0.12, -0.2], mesh(G.torus(0.36, 0.03, Math.PI * 1.3, 80), M.glow(), [0, 0, 0], undefined, [0, 0, Math.PI * 0.85]));
  moon.add(mesh(G.sphere(0.035, 16, 12), M.white(), [0.34, 0.12, 0]));
  headG.add(moon);
  b.spin.push({ o: moon, speed: 0.25, axis: "z" });
  b.body.add(headG);
  // 28 beads: her cycle, one lit for today
  const ring = group([0, 0.72, 0]);
  const phase = [M.tint, M.soft, M.gold, M.deep];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const m = i === 0 ? M.white() : phase[i < 5 ? 0 : i < 12 ? 1 : i < 16 ? 2 : 3];
    ring.add(mesh(G.sphere(i === 0 ? 0.034 : 0.022, 14, 10), m, [Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7]));
  }
  ring.rotation.x = 0.18;
  b.body.add(ring);
  b.spin.push({ o: ring, speed: 0.35, axis: "y" });
  const armL = group([0.27, 1.27, 0], arm(M, 0.42, 0.045));
  const armR = group([-0.27, 1.27, 0], arm(M, 0.42, 0.045));
  b.body.add(armL, armR);
  b.eyes.push(...hd.eyes);
  return finish(b, { head: headG, armL, armR, mouth: hd.mouth, float: 0.07, height: 2.2, headY: 1.66, bustH: 1.15 });
}

function vera(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  // feet + a little base
  for (const s of [-1, 1]) b.body.add(mesh(G.sphere(0.1, 20, 14), M.tint, [s * 0.16, 0.06, 0.04], [1.1, 0.6, 1.4]));
  // flask body (glass) with glowing liquid and bubbles
  const flask: [number, number][] = [[0.001, 0.14], [0.2, 0.15], [0.38, 0.24], [0.45, 0.42], [0.42, 0.6], [0.3, 0.76], [0.15, 0.86], [0.13, 1.06], [0.15, 1.1]];
  b.body.add(mesh(G.lathe(flask), M.glass));
  const liquid = new THREE.MeshPhysicalMaterial({ color: col(h, 0.9, 0.62), emissive: col(h, 0.9, 0.45), emissiveIntensity: 0.55, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.9 });
  b.body.add(mesh(G.lathe([[0.001, 0.16], [0.19, 0.17], [0.36, 0.26], [0.42, 0.42], [0.405, 0.56], [0.001, 0.56]]), liquid));
  b.body.add(mesh(G.cyl(0.405, 0.405, 0.006), new THREE.MeshBasicMaterial({ color: col(h, 1, 0.82), toneMapped: false }), [0, 0.56, 0]));
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const m = mesh(G.sphere(0.022 + (i % 3) * 0.008, 12, 8), M.white(), [Math.sin(i * 2.1) * 0.22, 0.2, Math.cos(i * 2.1) * 0.22]);
    bubbles.push(m);
    b.body.add(m);
  }
  b.body.add(mesh(G.torus(0.16, 0.03), M.tint, [0, 1.08, 0], undefined, [Math.PI / 2, 0, 0]));
  // head with lab goggles
  const headG = group([0, 1.36, 0]);
  headG.add(mesh(G.rbox(0.62, 0.46, 0.5, 0.17), M.pearl));
  headG.add(mesh(G.rbox(0.5, 0.3, 0.06, 0.07), M.visor, [0, -0.01, 0.235]));
  headG.add(mesh(G.torus(0.315, 0.025, Math.PI * 2, 60), M.tint, [0, 0.05, 0], [1, 1, 0.82], [Math.PI / 2, 0, 0]));
  const eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = group([s * 0.12, 0.0, 0.272]);
    e.add(mesh(G.torus(0.075, 0.018, Math.PI * 2, 36), M.metal));
    e.add(mesh(G.sphere(0.05, 20, 14), M.glow(), [0, 0, 0], [1, 1.1, 0.4]));
    e.add(mesh(G.sphere(0.016, 10, 8), M.white(), [0.017, 0.022, 0.02]));
    headG.add(e);
    eyes.push(e);
  }
  const mouth = mesh(G.cap(0.014, 0.05), M.glow(), [0, -0.1, 0.272], [0.6, 0.6, 0.5], [0, 0, Math.PI / 2]);
  headG.add(mouth);
  // pipette antenna
  headG.add(mesh(G.cyl(0.012, 0.012, 0.2, 12), M.glass, [0.12, 0.33, 0]));
  headG.add(mesh(G.sphere(0.045, 16, 12), M.tint, [0.12, 0.45, 0]));
  b.body.add(headG);
  const armL = group([0.36, 0.86, 0], arm(M, 0.3, 0.04));
  const armR = group([-0.36, 0.86, 0], arm(M, 0.3, 0.04));
  // test tube in her right hand
  const tube = group([0, -0.42, 0.06], mesh(G.cap(0.035, 0.18), M.glass), mesh(G.cap(0.028, 0.08), new THREE.MeshBasicMaterial({ color: col(h + 150, 0.8, 0.62), toneMapped: false }), [0, -0.05, 0]));
  tube.rotation.z = 0.3;
  armR.add(tube);
  b.body.add(armL, armR);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes,
    mouth,
    float: 0,
    height: 1.7,
    headY: 1.36,
    bustH: 1.2,
    tick: (t, s, e) => {
      const speed = s === "thinking" ? 0.9 : 0.35 + e * 0.2;
      bubbles.forEach((m, i) => {
        const p = (t * speed + i / 7) % 1;
        m.position.y = 0.2 + p * 0.34;
        m.scale.setScalar(p > 0.9 ? (1 - p) * 10 : 1);
      });
      liquid.emissiveIntensity = 0.45 + (s === "thinking" ? Math.sin(t * 6) * 0.2 + 0.2 : 0);
    },
  });
}

function sage(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  // legs + feet
  for (const s of [-1, 1]) {
    b.body.add(mesh(G.cap(0.07, 0.5), M.metal, [s * 0.12, 0.4, 0]));
    b.body.add(mesh(G.sphere(0.1, 20, 14), M.tint, [s * 0.12, 0.06, 0.05], [1, 0.55, 1.5]));
  }
  // long coat
  b.body.add(mesh(G.lathe([[0.001, 1.56], [0.2, 1.55], [0.28, 1.46], [0.3, 1.2], [0.33, 0.88], [0.36, 0.6], [0.34, 0.58]]), M.pearl));
  b.body.add(mesh(G.torus(0.315, 0.025), M.tint, [0, 1.06, 0], undefined, [Math.PI / 2, 0, 0]));
  // care badge (+)
  b.body.add(mesh(G.rbox(0.1, 0.03, 0.02, 0.008), M.glow(), [0.13, 1.3, 0.27]));
  b.body.add(mesh(G.rbox(0.03, 0.1, 0.02, 0.008), M.glow(), [0.13, 1.3, 0.27]));
  b.body.add(mesh(G.cyl(0.055, 0.065, 0.1), M.metal, [0, 1.6, 0]));
  // screen-face head
  const headG = group([0, 1.86, 0]);
  headG.add(mesh(G.rbox(0.48, 0.4, 0.38, 0.14), M.pearl));
  headG.add(mesh(G.rbox(0.38, 0.28, 0.05, 0.08), M.visor, [0, 0, 0.175]));
  const eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = group([s * 0.08, 0.03, 0.205], mesh(G.cap(0.026, 0.03), M.glow(), [0, 0, 0], [1, 1, 0.4]));
    headG.add(e);
    eyes.push(e);
  }
  const mouth = mesh(G.torus(0.045, 0.012, Math.PI, 20), M.glow(), [0, -0.05, 0.205], [1, 0.8, 0.5], [0, 0, Math.PI]);
  headG.add(mouth);
  // sprout
  const sprout = group([0, 0.2, 0], mesh(G.cyl(0.012, 0.016, 0.16, 10), M.deep, [0, 0.08, 0]));
  const leafMat = new THREE.MeshPhysicalMaterial({ color: col(h - 20, 0.6, 0.55), roughness: 0.35, clearcoat: 0.8 });
  sprout.add(mesh(G.sphere(0.08, 20, 12), leafMat, [0.07, 0.17, 0], [1, 0.32, 0.55], [0, 0, 0.5]));
  sprout.add(mesh(G.sphere(0.07, 20, 12), leafMat, [-0.06, 0.15, 0], [1, 0.32, 0.55], [0, 0, -0.6]));
  headG.add(sprout);
  b.body.add(headG);
  const armL = group([0.32, 1.45, 0], arm(M, 0.48, 0.045));
  const armR = group([-0.32, 1.45, 0], arm(M, 0.48, 0.045));
  // tablet with her care plan
  const tablet = group([0.04, -0.6, 0.1], mesh(G.rbox(0.24, 0.32, 0.03, 0.02), M.deep));
  for (let i = 0; i < 3; i++) tablet.add(mesh(G.rbox(0.15 - i * 0.03, 0.02, 0.01, 0.006), M.glow(), [-0.02 + i * 0.015, 0.08 - i * 0.07, 0.018]));
  tablet.rotation.set(-0.3, -0.5, 0.2);
  armR.add(tablet);
  b.body.add(armL, armR);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes,
    mouth,
    float: 0,
    height: 2.2,
    headY: 1.86,
    bustH: 1.0,
    tick: (t, s) => {
      sprout.rotation.z = Math.sin(t * 1.4) * 0.12 + (s === "speaking" ? Math.sin(t * 6) * 0.08 : 0);
    },
  });
}

function pip(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  const core = group([0, 0.78, 0]);
  core.add(mesh(G.sphere(0.42), M.pearl, [0, 0, 0], [1, 0.95, 0.95]));
  core.add(mesh(G.sphere(0.3), M.soft, [0, -0.1, 0.18], [1, 0.95, 0.75]));
  b.body.add(core);
  const hd = head(M, { r: 0.42, eye: "dot", gap: 0.4, eyeY: 0.18, visor: "none", mouth: false });
  // just the eyes and beak on her round body (the body is the head)
  hd.g.children[0].visible = false;
  const headG = group([0, 0.8, 0], hd.g);
  headG.add(mesh(new THREE.SphereGeometry(0.425, 48, 32, Math.PI * 0.14, Math.PI * 0.72, Math.PI * 0.2, Math.PI * 0.3), M.visor, [0, 0, 0], [1, 0.95, 0.95]));
  const beak = mesh(G.cone(0.06, 0.13, 20), M.gold, [0, 0.0, 0.44], undefined, [Math.PI / 2, 0, 0]);
  headG.add(beak);
  // tuft + bell
  for (let i = -1; i <= 1; i++) headG.add(mesh(G.cap(0.03, 0.12), M.tint, [i * 0.06, 0.45, -0.02], undefined, [0, 0, -i * 0.45]));
  const bell = group([0.0, 0.58, 0], mesh(G.lathe([[0.001, 0.0], [0.07, 0.0], [0.065, 0.03], [0.05, 0.09], [0.025, 0.12], [0.001, 0.125]], 32), M.gold));
  bell.add(mesh(G.sphere(0.018, 10, 8), M.gold, [0, -0.01, 0]));
  headG.add(bell);
  b.body.add(headG);
  // wings (they are her arms)
  const wing = () => mesh(G.sphere(0.2, 28, 16), M.tint, [0, -0.15, 0], [0.38, 1, 0.75]);
  const armL = group([0.4, 0.9, -0.02], wing());
  const armR = group([-0.4, 0.9, -0.02], wing());
  armL.rotation.z = 0.5;
  armR.rotation.z = -0.5;
  b.body.add(armL, armR);
  // tail + feet
  b.body.add(mesh(G.sphere(0.12, 20, 12), M.tint, [0, 0.7, -0.42], [0.7, 0.3, 1], [0.5, 0, 0]));
  for (const s of [-1, 1]) b.body.add(mesh(G.sphere(0.05, 14, 10), M.gold, [s * 0.11, 0.36, 0.1], [1, 0.6, 1.3]));
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes: hd.eyes,
    mouth: null,
    float: 0.16,
    height: 1.5,
    headY: 0.85,
    bustH: 1.3,
    tick: (t, s, e) => {
      const flap = Math.sin(t * (s === "handoff" ? 22 : 9 + e * 6)) * (0.25 + e * 0.25);
      armL.rotation.x = 0;
      armR.rotation.x = 0;
      armL.rotation.z = 0.55 + flap;
      armR.rotation.z = -0.55 - flap;
      bell.rotation.z = s === "speaking" || s === "handoff" ? Math.sin(t * 14) * 0.35 : Math.sin(t * 2) * 0.06;
    },
  });
}

function iris(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  const y0 = 0.42;
  // capsule body: pearl top, tinted bottom, glowing seam
  b.body.add(mesh(new THREE.SphereGeometry(0.36, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.tint, [0, y0, 0]));
  b.body.add(mesh(G.cyl(0.36, 0.36, 0.45), M.tint, [0, y0 + 0.225, 0]));
  b.body.add(mesh(G.cyl(0.362, 0.362, 0.04), M.glow(), [0, y0 + 0.45, 0]));
  b.body.add(mesh(G.cyl(0.36, 0.36, 0.4), M.pearl, [0, y0 + 0.67, 0]));
  // jets
  b.body.add(mesh(G.cone(0.12, 0.14, 24), M.metal, [0, y0 - 0.38, 0], undefined, [Math.PI, 0, 0]));
  b.body.add(mesh(G.cone(0.08, 0.18, 20), M.glow(), [0, y0 - 0.52, 0], [1, 1, 1], [Math.PI, 0, 0]));
  const hd = head(M, { r: 0.36, eye: "hex", gap: 0.34, eyeY: 0.05, visor: "band", sy: 1 });
  (hd.g.children[0] as THREE.Mesh).geometry = new THREE.SphereGeometry(0.36, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const headG = group([0, y0 + 0.87, 0], hd.g);
  // hd: visor band slightly lower on the dome
  hd.g.children[1].position.y = -0.06;
  hd.eyes.forEach((e) => (e.position.y -= 0.03));
  if (hd.mouth) hd.mouth.position.set(0, -0.12, 0.37);
  headG.add(mesh(G.cap(0.025, 0.08), M.tint, [0, 0.38, 0]));
  headG.add(mesh(G.sphere(0.04, 14, 10), M.glow(), [0, 0.46, 0]));
  b.body.add(headG);
  // orbiting hex chips (her medicines, kept in order)
  const orbit = group([0, y0 + 0.5, 0]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    orbit.add(mesh(G.cyl(0.07, 0.07, 0.03, 6), i === 1 ? M.gold : M.soft, [Math.cos(a) * 0.62, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.62], undefined, [Math.PI / 2, 0, a]));
  }
  orbit.rotation.x = 0.25;
  b.body.add(orbit);
  b.spin.push({ o: orbit, speed: 0.6, axis: "y" });
  const armL = group([0.46, y0 + 0.62, 0.05], hand(M, 0.3, 0.075));
  const armR = group([-0.46, y0 + 0.62, 0.05], hand(M, 0.3, 0.075));
  b.body.add(armL, armR);
  return finish(b, { head: headG, armL, armR, eyes: hd.eyes, mouth: hd.mouth, float: 0.2, height: 1.95, headY: y0 + 0.95, bustH: 1.3 });
}

function noor(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  const warm = new THREE.MeshPhysicalMaterial({ color: col(h, 0.85, 0.9), roughness: 0.55, sheen: 1, sheenColor: col(h + 20, 1, 0.8), clearcoat: 0.3 });
  const cloud = group([0, 0.95, 0]);
  const puffs: [number, number, number, number][] = [[0, 0, 0, 0.42], [0.34, -0.06, -0.02, 0.28], [-0.34, -0.06, -0.02, 0.28], [0.18, 0.22, -0.08, 0.26], [-0.2, 0.2, -0.06, 0.27], [0.5, -0.14, -0.08, 0.17], [-0.5, -0.14, -0.08, 0.17]];
  puffs.forEach(([x, y, z, r]) => cloud.add(mesh(G.sphere(r, 36, 24), warm, [x, y, z])));
  b.body.add(cloud);
  const hd = head(M, { r: 0.42, eye: "sleepy", gap: 0.38, eyeY: 0.02, visor: "none" });
  hd.g.children[0].visible = false;
  const headG = group([0, 0.95, 0], hd.g);
  // blush
  for (const s of [-1, 1]) headG.add(mesh(G.sphere(0.06, 16, 10), M.tint, [s * 0.25, -0.1, 0.33], [1, 0.6, 0.3]));
  // antenna with a star
  const stem = group([0.06, 0.38, 0], mesh(G.cyl(0.012, 0.014, 0.22, 10), M.deep, [0, 0.11, 0], undefined, [0, 0, -0.25]));
  const star = mesh(G.star(0.09, 0.04, 5, 0.03), M.glow(), [0.06, 0.25, 0]);
  stem.add(star);
  headG.add(stem);
  b.body.add(headG);
  // little stars drifting around her
  const sky = group([0, 1.0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    sky.add(mesh(G.star(0.04 + (i % 2) * 0.015, 0.018, 5, 0.012), i % 2 ? M.white() : M.glow(), [Math.cos(a) * 0.72, Math.sin(a * 3) * 0.18, Math.sin(a) * 0.5]));
  }
  b.body.add(sky);
  b.spin.push({ o: sky, speed: 0.2, axis: "y" });
  const armL = group([0.5, 0.88, 0.12], hand(M, 0.2, 0.1));
  const armR = group([-0.5, 0.88, 0.12], hand(M, 0.2, 0.1));
  (armL.children[0] as THREE.Mesh).material = warm;
  (armR.children[0] as THREE.Mesh).material = warm;
  b.body.add(armL, armR);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes: hd.eyes,
    mouth: hd.mouth,
    float: 0.22,
    height: 1.55,
    headY: 0.98,
    bustH: 1.4,
    tick: (t) => {
      star.rotation.z = t * 0.8;
      cloud.children.forEach((p, i) => (p.scale.setScalar(1 + Math.sin(t * 1.3 + i) * 0.025)));
    },
  });
}

function bloom(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  for (const s of [-1, 1]) {
    b.body.add(mesh(G.cap(0.06, 0.32), M.pearl, [s * 0.1, 0.3, 0]));
    b.body.add(mesh(G.sphere(0.08, 20, 14), M.tint, [s * 0.1, 0.06, 0.04], [1, 0.6, 1.4]));
  }
  // petal skirt
  const skirt = group([0, 0.72, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const p = mesh(G.sphere(0.2, 28, 16), i % 2 ? M.tint : M.soft, [Math.sin(a) * 0.2, -0.12, Math.cos(a) * 0.2], [0.75, 1.15, 0.28]);
    p.rotation.set(0.45 * Math.cos(a), a, -0.45 * Math.sin(a) * 0);
    p.lookAt(Math.sin(a) * 2, 1.3, Math.cos(a) * 2);
    skirt.add(p);
  }
  b.body.add(skirt);
  b.body.add(mesh(G.sphere(0.21), M.pearl, [0, 0.98, 0], [1, 1.25, 0.85]));
  b.body.add(mesh(G.cyl(0.05, 0.06, 0.1), M.metal, [0, 1.24, 0]));
  const hd = head(M, { r: 0.27, eye: "dot", gap: 0.38 });
  const headG = group([0, 1.5, 0], hd.g);
  // petal crown
  const crown = group([0, 0.24, -0.02]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = mesh(G.sphere(0.07, 20, 12), i % 2 ? M.tint : M.soft, [Math.sin(a) * 0.09, 0.02, Math.cos(a) * 0.09], [0.6, 1.1, 0.3]);
    p.lookAt(Math.sin(a) * 2, 1.2, Math.cos(a) * 2);
    crown.add(p);
  }
  crown.add(mesh(G.sphere(0.04, 14, 10), M.gold, [0, 0.04, 0]));
  headG.add(crown);
  b.body.add(headG);
  const armL = group([0.22, 1.12, 0], arm(M, 0.36, 0.04));
  const armR = group([-0.22, 1.12, 0], arm(M, 0.36, 0.04));
  b.body.add(armL, armR);
  // the glowing seed she holds
  const seed = group([0, 0.86, 0.3], mesh(G.sphere(0.075, 24, 16), M.glow()), mesh(G.sphere(0.12, 24, 16), new THREE.MeshBasicMaterial({ color: col(h, 1, 0.8), transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false })));
  b.body.add(seed);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes: hd.eyes,
    mouth: hd.mouth,
    float: 0,
    height: 1.95,
    headY: 1.5,
    bustH: 1.05,
    tick: (t, s) => {
      // hands cup the seed
      if (s !== "handoff" && s !== "thinking") {
        armL.rotation.x = -0.75;
        armR.rotation.x = -0.75;
        armL.rotation.z = -0.35;
        armR.rotation.z = 0.35;
      }
      seed.position.y = 0.86 + Math.sin(t * 2) * 0.025;
      seed.scale.setScalar(1 + Math.sin(t * 3) * 0.06 + (s === "speaking" ? 0.1 : 0));
      skirt.rotation.y = Math.sin(t * 0.8) * 0.12;
    },
  });
}

function maeve(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  const dress = new THREE.MeshPhysicalMaterial({ color: col(h, 0.5, 0.5), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: col(h + 20, 1, 0.75) });
  b.body.add(mesh(G.lathe([[0.001, 0.02], [0.34, 0.03], [0.36, 0.08], [0.27, 0.45], [0.21, 0.85], [0.22, 1.05], [0.001, 1.08]]), dress));
  b.body.add(mesh(G.sphere(0.22), M.pearl, [0, 1.2, 0], [1, 1.3, 0.8]));
  b.body.add(mesh(G.torus(0.21, 0.02), M.gold, [0, 1.02, 0], undefined, [Math.PI / 2, 0, 0]));
  b.body.add(mesh(G.cyl(0.05, 0.06, 0.14), M.metal, [0, 1.5, 0]));
  const hd = head(M, { r: 0.26, sy: 1.1, eye: "line", gap: 0.36 });
  // bob haircut
  hd.g.add(mesh(new THREE.SphereGeometry(0.3, 48, 32, Math.PI * 0.72, Math.PI * 1.56, 0, Math.PI * 0.7), dress, [0, 0.0, -0.01], [1.02, 1.12, 1.05]));
  for (const s of [-1, 1]) hd.g.add(mesh(G.sphere(0.025, 12, 8), M.gold, [s * 0.27, -0.14, 0.02]));
  const headG = group([0, 1.76, 0], hd.g);
  b.body.add(headG);
  // the wave scarf: a soft ribbon around her neck with a tail that ripples
  b.body.add(mesh(G.torus(0.165, 0.045, Math.PI * 2, 48), M.tint, [0, 1.47, 0.0], [1, 1, 0.9], [Math.PI / 2 - 0.15, 0, 0]));
  const tailCurve = new THREE.CatmullRomCurve3([0, 1, 2, 3, 4, 5].map((i) => new THREE.Vector3(Math.sin(i * 1.3) * 0.045, -i * 0.11, i * 0.012)));
  const tail = group([0.11, 1.44, 0.15], mesh(new THREE.TubeGeometry(tailCurve, 40, 0.042, 12), M.tint, [0, 0, 0], [1, 1, 0.45]));
  tail.add(mesh(G.sphere(0.03, 14, 10), M.glow(), [Math.sin(5 * 1.3) * 0.045, -0.56, 0.06]));
  b.body.add(tail);
  const armL = group([0.26, 1.36, 0], arm(M, 0.46, 0.042));
  const armR = group([-0.26, 1.36, 0], arm(M, 0.46, 0.042));
  b.body.add(armL, armR);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes: hd.eyes,
    mouth: hd.mouth,
    float: 0,
    height: 2.15,
    headY: 1.76,
    bustH: 1.05,
    tick: (t, s, e) => {
      tail.rotation.z = Math.sin(t * (1.6 + e * 1.4)) * 0.09;
      tail.rotation.x = Math.sin(t * 1.1) * 0.06;
    },
  });
}

function echo(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  // body: a floating drop
  b.body.add(mesh(G.lathe([[0.001, 0.3], [0.08, 0.32], [0.2, 0.45], [0.25, 0.62], [0.22, 0.78], [0.12, 0.88], [0.001, 0.9]]), M.pearl));
  b.body.add(mesh(G.torus(0.235, 0.018), M.glow(), [0, 0.64, 0], undefined, [Math.PI / 2, 0, 0]));
  const r = 0.4;
  const hd = head(M, { r, eye: "dot", gap: 0.3, eyeY: 0.1, mouth: false, visor: "band" });
  const headG = group([0, 1.3, 0], hd.g);
  // globe lines
  const line = M.glow();
  for (const y of [-0.5, 0, 0.5]) {
    const rr = Math.sqrt(1 - y * y) * r * 1.01;
    headG.add(mesh(G.torus(rr, 0.006, Math.PI * 2, 72), line, [0, y * r, 0], undefined, [Math.PI / 2, 0, 0]));
  }
  for (const a of [0.5, -0.5]) headG.add(mesh(G.torus(r * 1.01, 0.006, Math.PI, 72), line, [0, 0, 0], undefined, [0, Math.PI / 2 + a, Math.PI / 2]));
  // headphones
  for (const s of [-1, 1]) headG.add(mesh(G.cyl(0.11, 0.11, 0.08, 32), M.tint, [s * 0.42, 0, 0], undefined, [0, 0, Math.PI / 2]));
  headG.add(mesh(G.torus(0.43, 0.025, Math.PI, 48), M.deep, [0, 0, 0]));
  // sound-bar mouth
  const bars: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const m = mesh(G.cap(0.012, 0.03), M.glow(), [(i - 2) * 0.035, -0.13, Math.sqrt(r * r - 0.13 * 0.13) * 1.02]);
    bars.push(m);
    headG.add(m);
  }
  b.body.add(headG);
  // orbit with speech bubbles
  const orbit = group([0, 1.3, 0]);
  const ring = mesh(G.torus(0.66, 0.008, Math.PI * 2, 96), M.glow());
  ring.rotation.x = Math.PI / 2;
  orbit.add(ring);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    const bub = group([Math.cos(a) * 0.66, 0, Math.sin(a) * 0.66], mesh(G.rbox(0.18, 0.12, 0.05, 0.04), i ? M.soft : M.tint), mesh(G.cone(0.03, 0.06, 12), i ? M.soft : M.tint, [-0.04, -0.07, 0], undefined, [0, 0, 0.6]));
    orbit.add(bub);
  }
  orbit.rotation.z = 0.35;
  b.body.add(orbit);
  b.spin.push({ o: orbit, speed: 0.5, axis: "y" });
  const armL = group([0.32, 0.72, 0.06], hand(M, 0.12, 0.07));
  const armR = group([-0.32, 0.72, 0.06], hand(M, 0.12, 0.07));
  b.body.add(armL, armR);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes: hd.eyes,
    mouth: null,
    float: 0.18,
    height: 1.85,
    headY: 1.3,
    bustH: 1.25,
    tick: (t, s) => {
      const talk = s === "speaking" || s === "handoff";
      bars.forEach((m, i) => (m.scale.y = talk ? 0.6 + Math.abs(Math.sin(t * (9 + i * 2.3) + i)) * 2.4 : 0.7 + (i === 2 ? 0.3 : 0)));
    },
  });
}

function ora(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  for (const s of [-1, 1]) {
    b.body.add(mesh(G.cap(0.1, 0.36), M.metal, [s * 0.18, 0.36, 0]));
    b.body.add(mesh(G.rbox(0.2, 0.1, 0.3, 0.04), M.tint, [s * 0.18, 0.06, 0.04]));
  }
  b.body.add(mesh(G.rbox(0.72, 0.68, 0.46, 0.18), M.pearl, [0, 0.98, 0]));
  b.body.add(mesh(G.rbox(0.5, 0.1, 0.4, 0.04), M.tint, [0, 0.66, 0]));
  // verified badge
  b.body.add(mesh(G.cyl(0.09, 0.09, 0.03, 40), M.visor, [0, 1.05, 0.235], undefined, [Math.PI / 2, 0, 0]));
  b.body.add(mesh(G.cap(0.012, 0.03), M.glow(), [-0.025, 1.04, 0.255], undefined, [0, 0, 0.8]));
  b.body.add(mesh(G.cap(0.012, 0.07), M.glow(), [0.02, 1.06, 0.255], undefined, [0, 0, -0.6]));
  for (const s of [-1, 1]) b.body.add(mesh(G.sphere(0.13, 24, 16), M.tint, [s * 0.4, 1.22, 0]));
  b.body.add(mesh(G.cyl(0.07, 0.08, 0.1), M.metal, [0, 1.36, 0]));
  const headG = group([0, 1.56, 0]);
  headG.add(mesh(G.rbox(0.48, 0.36, 0.4, 0.14), M.pearl));
  headG.add(mesh(G.rbox(0.42, 0.11, 0.05, 0.05), M.visor, [0, 0.02, 0.18]));
  const scan = mesh(G.cap(0.022, 0.07), M.glow(), [0, 0.02, 0.21], [1, 1, 0.5], [0, 0, Math.PI / 2]);
  headG.add(scan);
  headG.add(mesh(G.cap(0.02, 0.1), M.tint, [0, 0.24, 0]));
  b.body.add(headG);
  const armL = group([0.44, 1.18, 0], arm(M, 0.36, 0.06, 0.085));
  const armR = group([-0.44, 1.18, 0], arm(M, 0.36, 0.06, 0.085));
  // shield on her left arm
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.2);
  sh.quadraticCurveTo(0.17, -0.12, 0.17, 0.06);
  sh.lineTo(0.17, 0.16);
  sh.quadraticCurveTo(0, 0.2, -0.17, 0.16);
  sh.lineTo(-0.17, 0.06);
  sh.quadraticCurveTo(-0.17, -0.12, 0, -0.2);
  const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 });
  const shield = group([0.1, -0.32, 0.08], mesh(sg, M.tint), mesh(G.torus(0.06, 0.012, Math.PI * 2, 32), M.glow(), [0, 0, 0.05]));
  shield.rotation.y = 0.9;
  armL.add(shield);
  b.body.add(armL, armR);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes: [scan],
    mouth: null,
    float: 0,
    height: 1.85,
    headY: 1.56,
    bustH: 1.25,
    tick: (t, s) => {
      scan.position.x = Math.sin(t * (s === "thinking" ? 5 : 1.6)) * 0.14;
    },
  });
}

function si(h: number): Bot {
  const b = base();
  const M = mats(h, b);
  // glass cape with a glowing heart inside
  b.body.add(mesh(G.lathe([[0.03, 1.25], [0.2, 1.2], [0.3, 0.95], [0.4, 0.6], [0.48, 0.3], [0.44, 0.26]]), M.glass));
  b.body.add(mesh(G.sphere(0.2), M.pearl, [0, 1.08, 0], [1, 1.2, 0.85]));
  const heart = mesh(G.sphere(0.1, 24, 16), M.glow(), [0, 0.68, 0]);
  b.body.add(heart);
  b.body.add(mesh(G.sphere(0.17, 24, 16), new THREE.MeshBasicMaterial({ color: col(h, 1, 0.82), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }), [0, 0.68, 0]));
  const hd = head(M, { r: 0.27, eye: "star", gap: 0.36 });
  const headG = group([0, 1.5, 0], hd.g);
  // halo: one light for every teammate
  const halo = group([0, 0.36, -0.02]);
  const hues = [335, 28, 165, 198, 262, 42, 348, 14];
  hues.forEach((hh, i) => {
    const a = (i / hues.length) * Math.PI * 2;
    halo.add(mesh(G.sphere(0.035, 14, 10), new THREE.MeshBasicMaterial({ color: col(hh, 0.95, 0.68), toneMapped: false }), [Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24]));
  });
  halo.add(mesh(G.torus(0.24, 0.005, Math.PI * 2, 64), M.glow(), [0, 0, 0], undefined, [Math.PI / 2, 0, 0]));
  headG.add(halo);
  b.spin.push({ o: halo, speed: 0.7, axis: "y" });
  b.body.add(headG);
  const armL = group([0.38, 1.1, 0.04], hand(M, 0.32, 0.07));
  const armR = group([-0.38, 1.1, 0.04], hand(M, 0.32, 0.07));
  b.body.add(armL, armR);
  return finish(b, {
    head: headG,
    armL,
    armR,
    eyes: hd.eyes,
    mouth: hd.mouth,
    float: 0.16,
    height: 2.0,
    headY: 1.5,
    bustH: 1.2,
    tick: (t, s) => heart.scale.setScalar(1 + Math.sin(t * (s === "thinking" ? 7 : 2.4)) * 0.15),
  });
}

const BUILD: Record<string, (h: number) => Bot> = { cycle: luna, labs: vera, visit: sage, reminders: pip, meds: iris, mood: noor, fertility: bloom, meno: maeve, echo, ora, si };

export function buildBot(id: string, hue: number): Bot {
  return (BUILD[id] ?? si)(hue);
}

/* ---------------------------------- motion ---------------------------------- */

const ENERGY: Record<CharState, number> = { idle: 0.2, listening: 0.5, thinking: 0.8, speaking: 0.7, done: 0.4, handoff: 1, waiting: 0 };

/**
 * Pose a character for time t (seconds).
 * calm = the device asks for less motion: she still breathes, blinks and
 * looks around, but slowly and without big moves.
 */
export function pose(b: Bot, s: CharState, t: number, seed: number, look: { x: number; y: number }, calm: boolean) {
  const k = calm ? 0.35 : 1;
  const tt = t + seed * 3.1;
  const e = ENERGY[s];
  // hovering / standing
  const hover = b.float ? b.float * (0.75 + Math.sin(tt * 1.25) * 0.25 * k) : 0;
  const hop = s === "handoff" && !calm ? Math.abs(Math.sin(tt * 7)) * 0.06 : s === "done" && !calm ? Math.abs(Math.sin(tt * 5)) * 0.03 : 0;
  b.root.position.y = hover + hop;
  b.root.rotation.z = Math.sin(tt * 0.7) * 0.02 * k;
  b.root.rotation.x = s === "listening" ? 0.07 : s === "waiting" ? 0.05 : 0;
  b.root.rotation.y = Math.sin(tt * 0.31) * 0.12 * k + look.x * 0.18;
  // breathing
  const br = 1 + Math.sin(tt * (1.6 + e)) * 0.012 * (calm ? 0.6 : 1);
  b.body.scale.set(1, br, 1);
  // head: looks where the pointer is, otherwise around; tilts by state
  const wanderX = Math.sin(tt * 0.37) * 0.35 + Math.sin(tt * 0.91) * 0.1;
  const wanderY = Math.sin(tt * 0.29) * 0.12;
  const lx = THREE.MathUtils.clamp(look.x * 0.6 + wanderX * 0.5 * k, -0.6, 0.6);
  const ly = THREE.MathUtils.clamp(look.y * 0.35 + wanderY * k, -0.3, 0.3);
  b.head.rotation.y = s === "thinking" ? -0.3 + Math.sin(tt * 0.8) * 0.08 : lx;
  b.head.rotation.x = s === "thinking" ? -0.18 : s === "waiting" ? 0.28 : s === "speaking" ? ly + Math.sin(tt * 4.2) * 0.05 * k : ly;
  b.head.rotation.z = s === "listening" ? 0.16 : s === "thinking" ? 0.1 : Math.sin(tt * 0.5) * 0.04 * k;
  // blink (and wide eyes when she listens, half-closed when waiting)
  const ph = (tt + seed) % 3.9;
  const blink = ph < 0.14 ? Math.max(0.08, Math.abs(ph - 0.07) / 0.07) : 1;
  const open = s === "waiting" ? 0.35 : s === "listening" ? 1.15 : 1;
  for (const eye of b.eyes) eye.scale.y = open * blink;
  // mouth light
  if (b.mouth) {
    const talk = s === "speaking" || s === "handoff" ? 0.6 + Math.abs(Math.sin(tt * 11) * Math.sin(tt * 3.7)) * 1.3 : 0.6;
    b.mouth.scale.set(talk > 0.7 ? 0.9 : 0.6, talk, 0.5);
  }
  // arms
  const swing = Math.sin(tt * 1.2) * 0.05 * k;
  let lz = 0.14 + swing, rz = -0.14 - swing, lx2 = 0, rx = 0;
  if (s === "speaking") {
    lx2 = -0.55 + Math.sin(tt * 2.3) * 0.25 * k;
    lz = 0.25;
  } else if (s === "thinking") {
    rx = -1.75;
    rz = 0.42;
  } else if (s === "listening") {
    lz = 0.22;
    rz = -0.22;
  } else if (s === "handoff") {
    rz = -2.55 + Math.sin(tt * 10) * 0.32 * k;
  } else if (s === "done") {
    lz = 0.35;
    rz = -0.35;
  } else if (s === "waiting") {
    lz = 0.06;
    rz = -0.06;
  }
  b.armL.rotation.set(lx2, 0, lz);
  b.armR.rotation.set(rx, 0, rz);
  // things that orbit
  for (const sp of b.spin) sp.o.rotation[sp.axis] = tt * sp.speed * (1 + e * 1.6) * (calm ? 0.5 : 1);
  // her lights
  const dim = s === "waiting" ? 0.45 : 1;
  const pulse = s === "thinking" ? 0.85 + Math.sin(tt * 6) * 0.15 : s === "speaking" ? 0.92 + Math.sin(tt * 9) * 0.08 : 1;
  for (const g of b.glows) g.m.color.copy(g.c).multiplyScalar(dim * pulse);
  b.tick?.(tt, s, e);
}

/* -------------------------------- lighting -------------------------------- */

/** a soft studio for reflections (like a photo light box), made once */
export function studio(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0xb8a9b3, side: THREE.BackSide }));
  room.add(box);
  const panel = (w: number, h: number, p: [number, number, number], c: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(...p);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(4, 2.4, [-3, 3, 3.5], 0xffffff);
  panel(3, 3, [4, 1, 2], 0xfff3f6);
  panel(6, 1.2, [0, 4.8, 0], 0xffffff);
  panel(3, 3, [0, -1, -4.8], 0xf6e6f0);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.03).texture;
  pm.dispose();
  return env;
}

export function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6d3dd, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd6e8, 1.2);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  return rim;
}

/** the soft shadow under her feet */
export function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, "rgba(70,30,55,0.42)");
  grad.addColorStop(0.55, "rgba(70,30,55,0.14)");
  grad.addColorStop(1, "rgba(70,30,55,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
}
