import * as THREE from "three";
import type { Shape } from "../../../agents/team";
import type { CharState } from "./Character";
import { iconPath } from "../../../ui/Icon";

/* =====================================================================
   OVEREO agents — living light.

   Each agent is a holographic being: a liquid core that ripples with
   noise (custom shaders), a glowing nucleus that holds her symbol,
   orbiting rings and a cloud of light particles. Every agent has her own
   colours, motion and ring pattern; states change how she moves:
     idle      slow breathing          listening  rings quicken, light gathers
     thinking  turbulence, fast orbit  speaking   rhythmic pulse
     handoff   a bright flash          waiting    dimmed
   ONE WebGL context renders every character in turn and copies each
   frame into the character's own 2D canvas, so any number of agents cost
   one GPU context. A governor watches the frame cost: on slow devices
   characters update less often, and if the device can't keep up at all
   they fall back to the light SVG versions. Off-screen characters and
   hidden tabs don't render. Reduced motion → one still frame.
   ===================================================================== */

export interface View {
  el: HTMLCanvasElement;
  shape: Shape;
  hue: number;
  glyph: string;
  state: CharState;
  visible: boolean;
  seed: number;
  /** called if the device is too slow for 3D (show the SVG instead) */
  onFallback?: () => void;
  last?: number;
}

/* ------------------------------- species ------------------------------- */
// each shape is a different "species" of being: how the core moves, its rings, its light
interface Species {
  freq: number;
  amp: number;
  rings: [number, number, number][]; // radius, tilt x, tilt z
  particles: number;
  squash: [number, number, number];
}
const SPECIES: Record<Shape, Species> = {
  moon: { freq: 1.6, amp: 0.1, rings: [[1.45, 1.2, 0.3]], particles: 90, squash: [1, 1, 1] },
  flask: { freq: 2.4, amp: 0.08, rings: [[1.4, 1.57, 0], [1.6, 1.57, 0]], particles: 70, squash: [0.92, 1.08, 0.92] },
  leaf: { freq: 1.2, amp: 0.13, rings: [[1.5, 0.6, 0.9]], particles: 110, squash: [0.9, 1.1, 0.9] },
  bird: { freq: 3.0, amp: 0.07, rings: [[1.42, 1.0, -0.4], [1.62, 1.9, 0.5]], particles: 80, squash: [1.05, 0.95, 1] },
  hex: { freq: 2.0, amp: 0.06, rings: [[1.5, 0.3, 0], [1.5, 1.57, 0.6], [1.5, 0.9, -0.9]], particles: 60, squash: [1, 1, 1] },
  star: { freq: 1.4, amp: 0.12, rings: [[1.55, 1.3, 0.2]], particles: 140, squash: [1, 1, 1] },
  flower: { freq: 2.8, amp: 0.11, rings: [[1.38, 1.57, 0], [1.58, 1.2, 1.2], [1.58, 1.2, -1.2]], particles: 100, squash: [1, 0.96, 1] },
  wave: { freq: 1.0, amp: 0.15, rings: [[1.5, 1.4, 0], [1.7, 1.4, 0]], particles: 90, squash: [1.04, 0.94, 1.04] },
  shield: { freq: 2.2, amp: 0.05, rings: [[1.5, 0.0, 0], [1.5, 1.57, 0]], particles: 50, squash: [0.96, 1.06, 0.96] },
  orb: { freq: 1.8, amp: 0.09, rings: [[1.5, 1.2, 0.5], [1.7, 1.9, -0.6]], particles: 160, squash: [1, 1, 1] },
  echo: { freq: 3.4, amp: 0.09, rings: [[1.4, 1.57, 0.0], [1.62, 1.57, 0.0], [1.84, 1.57, 0.0]], particles: 90, squash: [1.06, 0.96, 1] },
};

/* -------------------------------- shaders -------------------------------- */

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const CORE_VS = /* glsl */ `
uniform float uTime; uniform float uFreq; uniform float uAmp; uniform float uSeed;
varying vec3 vNormal; varying vec3 vView; varying float vN;
${NOISE}
void main(){
  vec3 p=position;
  // smooth, slow liquid motion (one main wave + a faint finer one)
  float n=snoise(normalize(p)*uFreq*0.7+vec3(uTime*0.3+uSeed));
  float n2=snoise(normalize(p)*uFreq*1.4-vec3(uTime*0.45));
  float d=(n*0.88+n2*0.12)*uAmp*0.45;
  vN=n;
  p+=normal*d;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  vNormal=normalize(normalMatrix*normal);
  vView=normalize(-mv.xyz);
  gl_Position=projectionMatrix*mv;
}`;

const CORE_FS = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uRim; uniform float uTime; uniform float uGlow; uniform float uDim;
varying vec3 vNormal; varying vec3 vView; varying float vN;
void main(){
  float f=pow(1.0-max(dot(vNormal,vView),0.0),2.2);
  // iridescent bands that drift with the surface
  // a calm two-tone sheen that flows across the surface, stronger towards the edge
  float band=0.5+0.5*sin(vN*1.6+uTime*0.45+f*3.0);
  vec3 body=mix(uA,uB,clamp(band*0.45+f*0.55,0.0,1.0));
  vec3 col=body*(0.8+0.35*(1.0-f))+uRim*f*(0.9+uGlow);
  // inner light, like a glass marble lit from inside
  col+=vec3(1.0)*pow(1.0-f,5.0)*0.18;
  // glossy highlights from two lights
  vec3 L=normalize(vec3(-0.45,0.7,0.6));
  vec3 L2=normalize(vec3(0.6,-0.3,0.5));
  col+=vec3(1.0)*pow(max(dot(reflect(-L,vNormal),vView),0.0),28.0)*0.8;
  col+=vec3(1.0)*pow(max(dot(reflect(-L2,vNormal),vView),0.0),12.0)*0.12;
  float a=0.86+0.14*f;
  gl_FragColor=vec4(col*uDim,a);
}`;

const RING_FS = /* glsl */ `
uniform vec3 uC; uniform float uTime; uniform float uDim; varying vec2 vUv;
void main(){
  float t=fract(vUv.x-uTime*0.25);
  float glow=0.25+0.75*smoothstep(0.0,0.9,t)*smoothstep(1.0,0.92,t);
  gl_FragColor=vec4(uC*(0.6+glow)*uDim,0.25+0.6*glow);
}`;
const RING_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

const DOT_VS = /* glsl */ `
uniform float uTime; uniform float uSpin; uniform float uPull; attribute float aSeed; varying float vA;
void main(){
  vec3 p=position;
  float a=uTime*uSpin*(0.4+aSeed);
  float c=cos(a), s=sin(a);
  p.xz=mat2(c,-s,s,c)*p.xz;
  p*=mix(1.0,0.72,uPull)+0.06*sin(uTime*2.0+aSeed*12.0);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  vA=0.35+0.65*fract(aSeed*7.13+uTime*0.15);
  gl_PointSize=(2.0+aSeed*3.0)*(6.5/-mv.z);
  gl_Position=projectionMatrix*mv;
}`;
const DOT_FS = /* glsl */ `
uniform vec3 uC; uniform float uDim; varying float vA;
void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; gl_FragColor=vec4(uC*uDim,(1.0-r*2.0)*vA); }`;

/* ------------------------------- the stage ------------------------------- */

interface Rig {
  root: THREE.Group;
  core: THREE.Mesh<THREE.IcosahedronGeometry, THREE.ShaderMaterial>;
  nucleus: THREE.Mesh;
  glyph: THREE.Mesh;
  rings: THREE.Mesh<THREE.TorusGeometry, THREE.ShaderMaterial>[];
  dots: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  halo: THREE.Mesh;
  sp: Species;
}

let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
const rigs = new Map<string, Rig>();
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
    renderer.setSize(256, 256, false);
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 7.6);
    camera.lookAt(0, 0, 0);
    addEventListener("pointermove", (e) => (pointer = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 }), { passive: true });
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && kick());
    return true;
  } catch {
    failed = true;
    renderer = null;
    return false;
  }
}

const col = (h: number, s: number, l: number) => new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);

/** her symbol, drawn from the app's own icon set */
function glyphTexture(name: string, hue: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.translate(16, 16);
  g.scale(4, 4);
  g.lineCap = "round";
  g.lineJoin = "round";
  const path = new Path2D(iconPath(name));
  // a soft dark outline so the symbol reads on the bright nucleus
  g.lineWidth = 3.2;
  g.strokeStyle = `hsla(${hue}, 70%, 24%, 0.8)`;
  g.stroke(path);
  g.lineWidth = 1.7;
  g.shadowColor = `hsl(${hue} 100% 85%)`;
  g.shadowBlur = 2;
  g.strokeStyle = "#fff";
  g.stroke(path);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a soft radial glow (the being's aura) */
function glowTexture(hue: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.9)`);
  grad.addColorStop(0.35, `hsla(${hue + 30}, 100%, 65%, 0.35)`);
  grad.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function build(shape: Shape, hue: number, glyph: string): Rig {
  const sp = SPECIES[shape] ?? SPECIES.orb;
  const root = new THREE.Group();
  const coreMat = new THREE.ShaderMaterial({
    vertexShader: CORE_VS,
    fragmentShader: CORE_FS,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uFreq: { value: sp.freq },
      uAmp: { value: sp.amp },
      uSeed: { value: hue / 37 },
      uA: { value: col(hue, 0.78, 0.56) },
      uB: { value: col(hue + 70, 0.82, 0.62) },
      uRim: { value: col(hue - 25, 1, 0.82) },
      uGlow: { value: 0 },
      uDim: { value: 1 },
    },
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 20), coreMat);
  core.scale.set(...sp.squash);
  root.add(core);

  // the nucleus: a bright heart that holds her symbol
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 16), new THREE.MeshBasicMaterial({ color: col(hue + 10, 1, 0.86), transparent: true, opacity: 0.85, blending: THREE.NormalBlending, depthWrite: false }));
  nucleus.position.z = 0.35;
  root.add(nucleus);
  const glyphMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), new THREE.MeshBasicMaterial({ map: glyphTexture(glyph, hue), transparent: true, depthWrite: false, depthTest: false }));
  glyphMesh.position.z = 0.9;
  glyphMesh.renderOrder = 10;
  root.add(glyphMesh);

  const rings = sp.rings.map(([r, tx, tz], i) => {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.018 + i * 0.004, 8, 160),
      new THREE.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, blending: THREE.NormalBlending, uniforms: { uC: { value: col(hue + 30 + i * 25, 1, 0.7) }, uTime: { value: 0 }, uDim: { value: 1 } } }),
    );
    m.rotation.set(tx, 0, tz);
    m.userData.base = { tx, tz, speed: 0.25 + i * 0.12, dir: i % 2 ? -1 : 1 };
    root.add(m);
    return m;
  });

  // light particles on a shell
  const n = sp.particles;
  const pos = new Float32Array(n * 3);
  const seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = 1.55 + Math.random() * 0.45;
    const q = Math.sqrt(1 - u * u);
    pos.set([Math.cos(t) * q * r, u * r * 0.8, Math.sin(t) * q * r], i * 3);
    seeds[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const dots = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: DOT_VS, fragmentShader: DOT_FS, transparent: true, depthWrite: false, blending: THREE.NormalBlending, uniforms: { uTime: { value: 0 }, uSpin: { value: 0.3 }, uPull: { value: 0 }, uC: { value: col(hue + 40, 1, 0.8) }, uDim: { value: 1 } } }));
  root.add(dots);

  // soft aura behind
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: glowTexture(hue), transparent: true, opacity: 0.5, blending: THREE.NormalBlending, depthWrite: false }));
  halo.position.z = -1.2;
  root.add(halo);

  scene.add(root);
  return { root, core, nucleus, glyph: glyphMesh, rings, dots, halo, sp };
}

function rigFor(v: View) {
  const key = `${v.shape}:${v.hue}:${v.glyph}`;
  let r = rigs.get(key);
  if (!r) {
    r = build(v.shape, v.hue, v.glyph);
    rigs.set(key, r);
  }
  return r;
}

const S_AMP: Record<CharState, number> = { idle: 1, listening: 1.2, thinking: 2.1, speaking: 1.6, done: 0.9, handoff: 1.8, waiting: 0.6 };
const S_SPIN: Record<CharState, number> = { idle: 0.25, listening: 0.6, thinking: 1.6, speaking: 0.7, done: 0.3, handoff: 2.2, waiting: 0.1 };

function pose(r: Rig, v: View, t0: number) {
  const s = v.state;
  const t = t0 + v.seed * 3;
  const reduceMotion = reduce();
  const time = reduceMotion ? v.seed * 3 : t;
  rigs.forEach((x) => (x.root.visible = x === r));
  const u = r.core.material.uniforms;
  u.uTime.value = time * (s === "thinking" ? 1.8 : 1);
  u.uAmp.value = r.sp.amp * S_AMP[s];
  const pulse = s === "speaking" ? Math.abs(Math.sin(t * 9)) * 0.6 + Math.abs(Math.sin(t * 3.7)) * 0.4 : 0;
  u.uGlow.value = s === "handoff" ? 0.9 + Math.sin(t * 12) * 0.3 : s === "done" ? 0.5 : pulse * 0.8 + (s === "listening" ? 0.35 : 0);
  const dim = s === "waiting" ? 0.45 : 1;
  u.uDim.value = dim;
  // breathing + gentle float
  const breathe = 1 + Math.sin(time * 1.4) * 0.025 + pulse * 0.05;
  r.root.scale.setScalar(breathe);
  r.root.position.y = reduceMotion ? 0 : Math.sin(time * 1.1) * 0.06;
  r.root.rotation.y = reduceMotion ? 0 : Math.sin(time * 0.4) * 0.25 + pointer.x * 0.25;
  r.root.rotation.x = reduceMotion ? 0 : pointer.y * 0.15;
  // nucleus looks toward the person
  r.nucleus.position.x = pointer.x * 0.12;
  r.nucleus.position.y = -pointer.y * 0.1;
  r.glyph.position.x = r.nucleus.position.x * 1.2;
  r.glyph.position.y = r.nucleus.position.y * 1.2;
  (r.nucleus.material as THREE.MeshBasicMaterial).opacity = (0.65 + pulse * 0.35 + (s === "thinking" ? Math.sin(t * 6) * 0.15 : 0)) * dim;
  (r.glyph.material as THREE.MeshBasicMaterial).opacity = 0.9 * dim;
  r.rings.forEach((m) => {
    const b = m.userData.base as { tx: number; tz: number; speed: number; dir: number };
    m.rotation.z = b.tz + time * b.speed * b.dir * S_SPIN[s] * 2;
    m.rotation.x = b.tx + Math.sin(time * 0.5 + b.speed) * 0.08;
    m.material.uniforms.uTime.value = time * (s === "thinking" ? 3 : 1);
    m.material.uniforms.uDim.value = dim;
  });
  const du = r.dots.material.uniforms;
  du.uTime.value = time;
  du.uSpin.value = S_SPIN[s];
  du.uPull.value = s === "listening" || s === "thinking" ? 0.8 : s === "handoff" ? 1 : 0;
  du.uDim.value = dim;
  (r.halo.material as THREE.MeshBasicMaterial).opacity = (0.42 + pulse * 0.25 + (s === "handoff" ? 0.3 : 0) + (s === "thinking" ? Math.sin(t * 5) * 0.1 : 0)) * dim;
}

/* ------------------------- governor + draw loop ------------------------- */

let cost = 0; // average ms per character frame
let frames = 0;
let turn = 0;
/** ms between updates of one character: busy states move smoothly, idle ones calmly */
const interval = (s: CharState) => {
  const base = s === "thinking" || s === "speaking" || s === "handoff" || s === "listening" ? 33 : 66;
  // slow device: update less often
  return cost > 10 ? base * 3 : cost > 5 ? base * 1.7 : base;
};

function giveUp() {
  failed = true;
  for (const v of views) v.onFallback?.();
  views.clear();
  rigs.forEach((r) => scene.remove(r.root));
  rigs.clear();
  renderer?.dispose();
  renderer = null;
}

function draw(now: number, all = false) {
  if (!renderer) return;
  // while a sheet or dialog is open, characters behind it rest (redrawing under a blurred glass layer is costly)
  const modal = document.querySelector('[aria-modal="true"]');
  const list = [...views].filter((v) => v.visible && v.el.width && v.el.height && (!modal || modal.contains(v.el)));
  if (!list.length) return;
  const start = performance.now();
  for (let k = 0; k < list.length; k++) {
    const v = list[(turn + k) % list.length];
    if (!all && v.last && now - v.last < interval(v.state)) continue;
    v.last = now;
    const t1 = performance.now();
    const r = rigFor(v);
    pose(r, v, now / 1000);
    renderer.render(scene, camera);
    const g = v.el.getContext("2d");
    if (g) {
      g.clearRect(0, 0, v.el.width, v.el.height);
      g.drawImage(renderer.domElement, 0, 0, v.el.width, v.el.height);
      if (!v.el.dataset.drawn) v.el.dataset.drawn = "1";
    }
    const dt = performance.now() - t1;
    frames++;
    // the first frames include compiling shaders — don't judge the device on those
    if (frames > 3) cost = frames === 4 ? dt : cost * 0.85 + dt * 0.15;
    // a device without real graphics power (one character costs ~25 ms+) gets the light versions
    if (frames > 12 && cost > 25) return giveUp();
    if (!all && performance.now() - start > 6) {
      turn = (turn + k + 1) % list.length;
      return;
    }
  }
}

function loop(now: number) {
  raf = 0;
  if (!renderer || document.visibilityState === "hidden") return;
  if (![...views].some((v) => v.visible)) return;
  draw(now);
  // nothing to draw right now (e.g. all behind a dialog): check again calmly
  if (!reduce() && ![...views].some((v) => v.visible && (!document.querySelector('[aria-modal="true"]') || document.querySelector('[aria-modal="true"]')!.contains(v.el)))) {
    setTimeout(kick, 400);
    return;
  }
  if (!reduce()) raf = requestAnimationFrame(loop);
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
    const r = build("orb", 330, "sparkle");
    const v = { state: "idle", seed: 0 } as View;
    pose(r, v, 0);
    renderer.render(scene, camera); // includes compiling the shaders
    const t = performance.now();
    for (let i = 0; i < 3; i++) {
      pose(r, v, i * 0.1);
      renderer.render(scene, camera);
    }
    renderer.getContext().finish();
    const per = (performance.now() - t) / 3;
    rigs.set("orb:330:sparkle", r);
    if (per > 20) {
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
  v.last = 0;
  // a still frame is enough when motion is reduced; otherwise the loop picks it up
  if (reduce()) {
    if (v.visible && renderer) draw(performance.now(), true);
  } else kick();
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
