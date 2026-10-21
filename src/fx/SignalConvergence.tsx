"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "../core/store";
import { useVisible } from "../lib/hooks";

/* ------------------------------------------------------------------ *
 * Signal Convergence — Three.js. Streaming signal lines from eight of
 * her data sources converge on a central hub. Packets travel the
 * curves, the hub tracks the pointer, and `progress` (scroll) lights
 * the streams one by one. Labels are DOM, projected every frame.
 * ------------------------------------------------------------------ */

export interface Source {
  id: string;
  label: string;
  value: string;
}

export function SignalConvergence({
  sources,
  progress,
  active = null,
  onHover,
  onSelect,
}: {
  sources: Source[];
  progress: number;
  /** the stream being read — highlighted until something else is hovered */
  active?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const vis = useVisible(host, "120px");
  const theme = useStore((s) => s.theme);
  const live = useRef({ vis, progress, theme, hover: -1, active: -1, onSelect });
  live.current.active = sources.findIndex((x) => x.id === active);
  live.current.onSelect = onSelect;
  live.current.vis = vis;
  live.current.progress = progress;
  live.current.theme = theme;
  const [hover, setHover] = useState(-1);
  const [emph, setEmph] = useState(-1);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      el.classList.add("no-webgl");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.4, 9.5);

    const N = sources.length;
    const group = new THREE.Group();
    scene.add(group);

    // Source positions on a tilted ring with some depth
    const srcPos = sources.map((_, i) => {
      const a = (i / N) * Math.PI * 2 + 0.3;
      return new THREE.Vector3(Math.cos(a) * 4.4, Math.sin(a) * 2.5, Math.sin(a * 2) * 1.4 - 0.4);
    });

    // Hub
    const hubMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uC1: { value: new THREE.Color("#EAA6BC") },
        uC2: { value: new THREE.Color("#58364F") },
        uCoreA: { value: 0.55 },
      },
      // a liquid glass pearl: gentle surface ripples, bright fresnel rim,
      // an inner swirl so it reads as "thinking"
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uTime;
        void main(){ vec3 p = position + normal * 0.022 * sin(uTime*1.6 + position.y*7.0 + position.x*5.0);
        vP = position; vec4 mv = modelViewMatrix * vec4(p,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform vec3 uC1; uniform vec3 uC2; uniform float uCoreA; uniform float uTime;
        void main(){ float f = pow(1. - max(dot(vN, vV), 0.), 2.0);
        float swirl = 0.5 + 0.5*sin(atan(vP.y, vP.x)*3.0 + uTime*1.4 + length(vP.xy)*9.0);
        vec3 c = mix(uC2, uC1, clamp(f + swirl*0.18, 0., 1.)) + uC1 * pow(f, 5.) * 0.9;
        float spec = pow(max(dot(reflect(-normalize(vec3(-0.6,0.8,0.6)), vN), vV), 0.), 24.);
        c += vec3(1.) * spec * 0.6;
        gl_FragColor = vec4(c, mix(uCoreA, 1.0, f)); }`,
    });
    const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 5), hubMat);
    group.add(hub);
    const coreMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe9f0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const core = new THREE.Sprite(coreMat);
    core.scale.setScalar(3.4);
    group.add(core);

    // Rings around the hub
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xeaa6bc, transparent: true, opacity: 0.35 });
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.95 + i * 0.28, 0.006, 8, 160), ringMat.clone());
      r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rings.push(r);
      group.add(r);
    }

    // Streams
    type Stream = { curve: THREE.QuadraticBezierCurve3; line: THREE.Mesh; mat: THREE.ShaderMaterial; packets: THREE.Points; offs: Float32Array; node: THREE.Mesh };
    const streams: Stream[] = [];
    const nodeGeo = new THREE.SphereGeometry(0.11, 24, 24);
    srcPos.forEach((p, i) => {
      const mid = p.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.8 * Math.sin(i * 1.7), 1.2 * Math.cos(i)));
      const curve = new THREE.QuadraticBezierCurve3(p, mid, new THREE.Vector3(0, 0, 0));
      // a thin glowing tube (WebGL lines are 1px; tubes read clearly at any DPR)
      const g = new THREE.TubeGeometry(curve, 120, 0.016, 8, false);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uOn: { value: 0 },
          uHover: { value: 0 },
          uC: { value: new THREE.Color().setHSL((330 + i * 9) / 360, 0.32, 0.72) },
        },
        vertexShader: `varying float vT; void main(){ vT = uv.x; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `varying float vT; uniform float uTime; uniform float uOn; uniform float uHover; uniform vec3 uC;
          void main(){ float flow = 0.5 + 0.5*sin(vT*38.0 - uTime*6.0);
          float a = (0.16 + 0.7*uOn*(0.35 + 0.65*flow) + 0.45*uHover) * smoothstep(0.0, 0.08, vT);
          gl_FragColor = vec4(mix(uC, vec3(1.0), 0.22*flow*uOn), min(a, 1.)); }`,
      });
      const line = new THREE.Mesh(g, mat);
      group.add(line);

      const PK = 14;
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PK * 3), 3));
      const pm = new THREE.PointsMaterial({ size: 0.13, map: glowTexture(), color: new THREE.Color().setHSL((335 + i * 8) / 360, 0.32, 0.82), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const packets = new THREE.Points(pg, pm);
      group.add(packets);
      const offs = new Float32Array(PK).map(() => Math.random());

      const node = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((330 + i * 9) / 360, 0.32, 0.7), transparent: true }));
      node.position.copy(p);
      node.userData.i = i;
      group.add(node);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: (node.material as THREE.MeshBasicMaterial).color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
      halo.scale.setScalar(0.9);
      node.add(halo);
      streams.push({ curve, line, mat, packets, offs, node });
    });

    // Ambient dust
    const DUST = 700;
    const dg = new THREE.BufferGeometry();
    const dp = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dp[i * 3] = (Math.random() - 0.5) * 16;
      dp[i * 3 + 1] = (Math.random() - 0.5) * 9;
      dp[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.035, color: 0xeaa6bc, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(dust);

    // Sizing
    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = r.width / Math.max(1, r.height);
      camera.position.z = camera.aspect < 0.9 ? 15 : camera.aspect < 1.3 ? 11.5 : 9.5;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Pointer tracking + hover picking
    const mouse = new THREE.Vector2(0, 0);
    const target = new THREE.Vector2(0, 0);
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2(10, 10);
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      target.set(ndc.x, ndc.y);
    };
    const onLeave = () => {
      ndc.set(10, 10);
      target.set(0, 0);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    // tap or click a node to read that stream (touch has no hover, so pick here)
    const onClick = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects(streams.map((s) => s.node), false)[0];
      if (hit) live.current.onSelect?.(sources[hit.object.userData.i as number].id);
    };
    el.addEventListener("click", onClick);

    const tmp = new THREE.Vector3();
    const tint = new THREE.Color();
    let shown = -2;
    let raf = 0;
    let time = 0;
    let last = performance.now();
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
      const dark = L.theme === "dark";
      hubMat.uniforms.uTime.value = time;
      hubMat.uniforms.uC1.value.set(dark ? "#F3D3DE" : "#A86F8E");
      hubMat.uniforms.uC2.value.set(dark ? "#58364F" : "#FBEEF2");
      hubMat.uniforms.uCoreA.value = dark ? 0.6 : 0.8;
      coreMat.opacity = dark ? 0.9 : 0.7;
      (dust.material as THREE.PointsMaterial).color.set(dark ? "#EAA6BC" : "#8A5A77");

      mouse.lerp(target, Math.min(1, dt * 3));
      group.rotation.y = mouse.x * 0.35 + Math.sin(time * 0.15) * 0.08;
      group.rotation.x = -mouse.y * 0.22;
      hub.rotation.y += dt * 0.25;
      hub.rotation.x += dt * 0.1;
      rings.forEach((r, i) => {
        r.rotation.z += dt * (0.2 + i * 0.12);
        r.rotation.x += dt * 0.05 * (i + 1);
        (r.material as THREE.MeshBasicMaterial).color.set(dark ? "#EAA6BC" : "#8A5A77");
      });
      dust.rotation.y += dt * 0.01;

      // hover picking
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(streams.map((s) => s.node), false);
      const h = hits.length ? (hits[0].object.userData.i as number) : -1;
      if (h !== L.hover) {
        L.hover = h;
        setHover(h);
        onHover?.(h >= 0 ? sources[h].id : null);
        el.style.cursor = h >= 0 ? "pointer" : "";
      }

      const lit = L.progress * (N + 1);
      const emph = L.hover >= 0 ? L.hover : L.active;
      if (emph !== shown) {
        shown = emph;
        setEmph(emph);
      }
      // the core takes on the colour of the stream it's reading
      if (emph >= 0) tint.setHSL((330 + emph * 9) / 360, 0.45, dark ? 0.85 : 0.72);
      else tint.set(dark ? "#FFE9F0" : "#F6B9CF");
      coreMat.color.lerp(tint, Math.min(1, dt * 3));
      streams.forEach((s, i) => {
        const on = Math.max(0, Math.min(1, lit - i));
        s.mat.uniforms.uTime.value = time;
        s.mat.uniforms.uC.value.setHSL((330 + i * 9) / 360, dark ? 0.34 : 0.26, dark ? 0.74 : 0.52);
        s.mat.uniforms.uOn.value += (on - s.mat.uniforms.uOn.value) * Math.min(1, dt * 4);
        s.mat.uniforms.uHover.value += ((emph === i ? 1 : 0) - s.mat.uniforms.uHover.value) * Math.min(1, dt * 8);
        const pos = s.packets.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let k = 0; k < s.offs.length; k++) {
          s.offs[k] = (s.offs[k] + dt * (0.18 + 0.05 * (k % 3))) % 1;
          s.curve.getPoint(s.offs[k], tmp);
          pos.setXYZ(k, tmp.x, tmp.y, tmp.z);
        }
        pos.needsUpdate = true;
        (s.packets.material as THREE.PointsMaterial).opacity = 0.15 + 0.85 * s.mat.uniforms.uOn.value;
        const sc = 1 + 0.6 * s.mat.uniforms.uHover.value + 0.15 * Math.sin(time * 3 + i);
        s.node.scale.setScalar(sc);

        // project label
        const lab = labels.current[i];
        if (lab) {
          s.node.getWorldPosition(tmp);
          tmp.project(camera);
          const r = el.getBoundingClientRect();
          // keep every label inside the frame (labels sit 14px right/below their node)
          const x = Math.max(-10, Math.min(r.width - lab.offsetWidth - 18, (tmp.x * 0.5 + 0.5) * r.width));
          const y = Math.max(-10, Math.min(r.height - lab.offsetHeight - 18, (-tmp.y * 0.5 + 0.5) * r.height));
          lab.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          lab.style.opacity = String(0.35 + 0.65 * Math.max(s.mat.uniforms.uOn.value, s.mat.uniforms.uHover.value));
        }
      });

      const pulse = 1 + 0.05 * Math.sin(time * 2.2) + 0.12 * L.progress;
      hub.scale.setScalar(pulse);
      core.scale.setScalar(3.0 + 1.2 * L.progress);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length]);

  return (
    <div ref={host} className="converge-canvas">
      {sources.map((s, i) => (
        <div
          key={s.id}
          ref={(n) => void (labels.current[i] = n)}
          className={`conv-label glass-thin ${hover === i || emph === i ? "hover" : ""}`}
          role="button"
          tabIndex={-1}
          onClick={() => onSelect?.(s.id)}
        >
          <span className="conv-name">{s.label}</span>
          <span className="conv-val mono">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

let _glow: THREE.Texture | null = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,.75)");
  grd.addColorStop(0.45, "rgba(255,255,255,.18)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
