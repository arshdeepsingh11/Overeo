"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../core/store";
import { useVisible } from "../lib/hooks";
import { attachGestures } from "../lib/gesture";
import { glowTexture } from "./SignalConvergence";

/* ------------------------------------------------------------------ *
 * Planet System — the Ovarian Clock visualised.
 *  • Procedural planet (domain-warped fbm) = her biology
 *  • Atmosphere (fresnel) + specular highlight from an interactive light
 *  • Orbit ring of ticks = the reproductive timeline, age 15 → 51
 *    (a bright marker at her marker age, a ghost at her calendar age)
 *  • Moons = biomarkers (AMH, FSH, oestradiol, DNAm), sized by value
 * Types change the surface palette. Drag to spin; pinch/scroll to zoom.
 * ------------------------------------------------------------------ */

export type PlanetType = "bloom" | "equinox" | "ember";

export interface Moon {
  id: string;
  label: string;
  value: string;
  size: number; // 0.4 – 1.4
}

const PALETTES: Record<PlanetType, [string, string, string, string]> = {
  bloom: ["#7A4767", "#A86F8E", "#F1B7CB", "#FFF4F8"],
  equinox: ["#29232A", "#8A5A77", "#C4C6E8", "#F8DCE5"],
  ember: ["#4A2A2A", "#9A3B2E", "#E8CBA8", "#FFF4E6"],
};

const PLANET_FRAG = `
uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uD; uniform vec3 uLight;
varying vec3 vN; varying vec3 vP; varying vec3 vV;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float v=0., a=.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=.5; } return v; }
void main(){
  vec3 p = vP * 1.6;
  float t = uTime * .03;
  vec3 q = vec3(fbm(p + vec3(t,0.,0.)), fbm(p + vec3(5.2,1.3,t)), fbm(p + vec3(2.1,t,7.7)));
  float h = fbm(p + 2.2*q + vec3(0., t*2., 0.));
  float bands = sin((vP.y*5.0 + h*3.5) ) * .5 + .5;
  vec3 col = mix(uA, uB, smoothstep(.25,.6,h));
  col = mix(col, uC, smoothstep(.55,.85,h*.7 + bands*.35));
  col = mix(col, uD, smoothstep(.82,1.,h + .15*bands));
  vec3 L = normalize(uLight);
  float diff = max(dot(vN, L), 0.);
  float wrap = max(dot(vN, L)*.5+.5, 0.);
  vec3 H = normalize(L + vV);
  float spec = pow(max(dot(vN, H), 0.), 48.) * (0.35 + 0.65*smoothstep(.6,.9,h));
  float rim = pow(1. - max(dot(vN, vV), 0.), 3.);
  vec3 c = col * (0.18 + 0.95*diff + 0.15*wrap) + vec3(1.,.95,.97)*spec*.9 + uC*rim*.55;
  gl_FragColor = vec4(c, 1.);
}`;

const PLANET_VERT = `varying vec3 vN; varying vec3 vP; varying vec3 vV;
void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;

const ATMO_FRAG = `uniform vec3 uC; uniform vec3 uLight; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.6); float l = max(dot(vN, normalize(uLight))*.6+.4, 0.); gl_FragColor = vec4(uC, f*l*1.1); }`;

export function PlanetSystem({
  type,
  span,
  calendarSpan,
  moons,
}: {
  type: PlanetType;
  span: number; // 0..1 marker age along reproductive span
  calendarSpan: number;
  moons: Moon[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const ageLabels = useRef<(HTMLDivElement | null)[]>([]);
  const vis = useVisible(host, "120px");
  const theme = useStore((s) => s.theme);
  const live = useRef({ vis, type, span, calendarSpan, theme, moons });
  live.current = { vis, type, span, calendarSpan, theme, moons };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.classList.add("no-webgl");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 1.1, 11.5);
    camera.lookAt(0, 0, 0);

    const world = new THREE.Group();
    world.rotation.x = 0.32;
    scene.add(world);

    const lightDir = new THREE.Vector3(-1, 0.6, 0.9);
    const pal = PALETTES[live.current.type];
    const planetMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(pal[0]) },
        uB: { value: new THREE.Color(pal[1]) },
        uC: { value: new THREE.Color(pal[2]) },
        uD: { value: new THREE.Color(pal[3]) },
        uLight: { value: lightDir },
      },
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1.55, 128, 128), planetMat);
    world.add(planet);

    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Color(pal[2]) }, uLight: { value: lightDir } },
      vertexShader: PLANET_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.86, 96, 96), atmoMat);
    world.add(atmo);

    // Timeline ring — ticks for ages 15 → 51
    const R = 2.75;
    const ring = new THREE.Group();
    world.add(ring);
    const tickPos: number[] = [];
    const AGES = 36;
    const startA = Math.PI * 0.75;
    const sweep = Math.PI * 1.5 * -1; // clockwise 270°
    for (let i = 0; i <= AGES; i++) {
      const a = startA + (i / AGES) * sweep;
      const major = i % 5 === 0;
      const r1 = R - (major ? 0.14 : 0.07);
      const r2 = R + (major ? 0.14 : 0.07);
      tickPos.push(Math.cos(a) * r1, 0, Math.sin(a) * r1, Math.cos(a) * r2, 0, Math.sin(a) * r2);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(tickPos, 3));
    const tickMat = new THREE.LineBasicMaterial({ color: 0xeaa6bc, transparent: true, opacity: 0.55 });
    ring.add(new THREE.LineSegments(tg, tickMat));

    // Progress arc (tube) from 15 to marker age
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xeaa6bc, transparent: true, opacity: 0.9 });
    let arc: THREE.Mesh | null = null;
    const buildArc = (s: number) => {
      if (arc) {
        ring.remove(arc);
        arc.geometry.dispose();
      }
      const pts: THREE.Vector3[] = [];
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const a = startA + ((i / steps) * s) * sweep;
        pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
      }
      const path = new THREE.CatmullRomCurve3(pts);
      arc = new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.018, 8, false), arcMat);
      ring.add(arc);
    };
    let builtSpan = -1;
    let shownSpan = 0;

    const mkMarker = (color: number, size: number) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(size);
      ring.add(sp);
      return sp;
    };
    const markerNow = mkMarker(0xffd6e4, 0.9);
    const markerCal = mkMarker(0xffffff, 0.5);
    const posOn = (s: number, v: THREE.Vector3) => {
      const a = startA + s * sweep;
      return v.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    };

    // Moons
    const moonObjs = live.current.moons.map((m, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((330 + i * 18) / 360, 0.45, 0.72), roughness: 0.55, metalness: 0.1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 40, 40), mat);
      const pivot = new THREE.Group();
      pivot.rotation.set(0.35 * (i - 1.5), i * 1.4, 0.2 * i);
      pivot.add(mesh);
      mesh.position.set(2.05 + i * 0.36, 0, 0);
      world.add(pivot);
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(2.05 + i * 0.36, 0.0035, 6, 200),
        new THREE.MeshBasicMaterial({ color: 0xeaa6bc, transparent: true, opacity: 0.18 }),
      );
      orbit.rotation.x = Math.PI / 2;
      pivot.add(orbit);
      return { mesh, pivot, speed: 0.22 / (1 + i * 0.35) };
    });
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffe6ee, 0.55));

    // Starfield / dust
    const SD = 500;
    const sp = new Float32Array(SD * 3);
    for (let i = 0; i < SD; i++) {
      const r = 6 + Math.random() * 10;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
      sp[i * 3 + 1] = r * Math.cos(ph);
      sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 6;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.04, color: 0xeaa6bc, transparent: true, opacity: 0.6, depthWrite: false }));
    scene.add(stars);

    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Interaction: drag spins (inertia), pointer moves light, pinch/ctrl-wheel zooms
    let spinV = 0.12;
    let tiltT = 0.32;
    let zoom = 11.5;
    const lightT = new THREE.Vector3(-1, 0.6, 0.9);
    const off = attachGestures(el, {
      onDrag: (dx, dy) => {
        world.rotation.y += dx * 0.008;
        tiltT = Math.max(-0.2, Math.min(0.9, tiltT + dy * 0.004));
        spinV = 0;
      },
      onDragEnd: (vx) => {
        spinV = Math.max(-2, Math.min(2, vx * 0.03)) || 0.12;
      },
      onPinch: (s) => {
        zoom = Math.max(7, Math.min(16, zoom / s));
      },
      onWheel: (_dx, dy, ctrl, e) => {
        if (!ctrl) return;
        e.preventDefault();
        zoom = Math.max(7, Math.min(16, zoom + dy * 0.01));
      },
    });
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = -((e.clientY - r.top) / r.height) * 2 + 1;
      lightT.set(x * 2.2, y * 1.6 + 0.4, 1.2);
    };
    el.addEventListener("pointermove", onMove);

    const v = new THREE.Vector3();
    let raf = 0;
    let time = 0;
    let last = performance.now();
    let lastType = live.current.type;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const L = live.current;
      if (!L.vis) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;

      if (L.type !== lastType) {
        lastType = L.type;
        const p = PALETTES[L.type];
        ["uA", "uB", "uC", "uD"].forEach((k, i) => (planetMat.uniforms[k].value as THREE.Color).set(p[i]));
        atmoMat.uniforms.uC.value.set(p[2]);
      }
      // ease the clock hand toward the target and rebuild the arc as it moves
      shownSpan += (L.span - shownSpan) * Math.min(1, dt * 2.5);
      if (Math.abs(shownSpan - builtSpan) > 0.003) {
        builtSpan = shownSpan;
        buildArc(Math.max(0.002, builtSpan));
      }
      planetMat.uniforms.uTime.value = time;
      lightDir.lerp(lightT, Math.min(1, dt * 2.5)).normalize();
      sun.position.copy(lightDir).multiplyScalar(10);

      world.rotation.y += spinV * dt;
      spinV += (0.12 - spinV) * Math.min(1, dt * 0.6);
      world.rotation.x += (tiltT - world.rotation.x) * Math.min(1, dt * 4);
      camera.position.z += (zoom - camera.position.z) * Math.min(1, dt * 5);
      planet.rotation.y += dt * 0.05;
      stars.rotation.y -= dt * 0.006;

      const dark = L.theme === "dark";
      tickMat.color.set(dark ? "#EAA6BC" : "#8A5A77");
      arcMat.color.set(dark ? "#F3D3DE" : "#8A5A77");

      posOn(shownSpan, markerNow.position);
      markerNow.scale.setScalar(0.85 + 0.15 * Math.sin(time * 3));
      posOn(L.calendarSpan, markerCal.position);

      moonObjs.forEach((m, i) => {
        m.pivot.rotation.y += m.speed * dt;
        const target = L.moons[i]?.size ?? 1;
        const s = m.mesh.scale.x + (target - m.mesh.scale.x) * Math.min(1, dt * 4);
        m.mesh.scale.setScalar(s);
      });

      renderer.render(scene, camera);

      // Project DOM labels AFTER rendering, so they use this frame's matrices.
      const r = el.getBoundingClientRect();
      const toScreen = (obj: THREE.Object3D) => {
        obj.getWorldPosition(v);
        const dist = v.distanceTo(camera.position);
        v.project(camera);
        return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, dist };
      };
      const centerDist = camera.position.length();
      const centerPx = { x: r.width / 2, y: r.height / 2 };
      const planetPx = (1.62 / centerDist) * (r.height / 2) / Math.tan((camera.fov * Math.PI) / 360);
      moonObjs.forEach((m, i) => {
        const lab = labels.current[i];
        if (!lab) return;
        const p = toScreen(m.mesh);
        // hidden if it sits behind the planet disc
        const behind = p.dist > centerDist && Math.hypot(p.x - centerPx.x, p.y - centerPx.y) < planetPx;
        lab.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        lab.style.opacity = behind ? "0" : "1";
      });
      [markerNow, markerCal].forEach((mk, i) => {
        const lab = ageLabels.current[i];
        if (!lab) return;
        const p = toScreen(mk);
        lab.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      });
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
      el.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={host} className="planet-canvas" role="img" aria-label="Ovarian Clock planet. Drag to rotate.">
      {moons.map((m, i) => (
        <div key={m.id} ref={(n) => void (labels.current[i] = n)} className="moon-label">
          <span className="glass-thin">
            <b>{m.label}</b> <span className="mono">{m.value}</span>
          </span>
        </div>
      ))}
      <div ref={(n) => void (ageLabels.current[0] = n)} className="age-label now">
        <span>marker age</span>
      </div>
      <div ref={(n) => void (ageLabels.current[1] = n)} className="age-label cal">
        <span>calendar age</span>
      </div>
    </div>
  );
}
