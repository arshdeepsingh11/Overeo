"use client";

import { useEffect, useRef, useState, lazy, Suspense } from "react";
import * as THREE from "three";
import { useStore, store } from "../core/store";
import { useDerived } from "../core/derived";
import { Icon } from "../ui/Icon";
import { SkeletonShape } from "../ui/Motion";

const PlanetSystem = lazy(() => import("../fx/PlanetSystem").then((m) => ({ default: m.PlanetSystem })));

/* =====================================================================
   AR mode — three tiers, chosen automatically:
     1. WebXR immersive-ar (Android Chrome & XR headsets): the Ovarian
        Clock planet floats in your room; tap to re-place it.
     2. Camera passthrough: your rear camera behind a transparent 3D
        scene ("lightweight AR") — works on most phones and laptops.
     3. 3D view: no camera needed.
   Camera and XR need HTTPS (or localhost).
   ===================================================================== */

type Tier = "choose" | "camera" | "view" | "xr";

export function ARMode() {
  const mode = useStore((s) => s.mode);
  if (mode !== "ar") return null;
  return <AR />;
}

function AR() {
  const d = useDerived();
  const [tier, setTier] = useState<Tier>("choose");
  const [xrOk, setXrOk] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    const xr = (navigator as unknown as { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    if (!xr) return setXrOk(false);
    xr.isSessionSupported("immersive-ar").then(setXrOk).catch(() => setXrOk(false));
  }, []);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const startCamera = async () => {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.current = s;
      setTier("camera");
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      });
    } catch {
      setErr(location.protocol !== "https:" && location.hostname !== "localhost" ? "Camera needs HTTPS. Showing the 3D view instead." : "Camera permission was blocked. Showing the 3D view instead.");
      setTier("view");
    }
  };

  const moons = [
    { id: "amh", label: "AMH", value: `${d.profile.markers.amh}`, size: 0.55 + Math.min(1, d.profile.markers.amh / 4) * 0.9 },
    { id: "fsh", label: "FSH", value: `${d.profile.markers.fsh}`, size: 0.5 + Math.min(1, d.profile.markers.fsh / 20) * 0.9 },
    { id: "e2", label: "E2", value: "48", size: 0.8 },
    { id: "dnam", label: "DNAm", value: `${(d.profile.age + d.profile.markers.epigeneticDelta).toFixed(1)}`, size: 0.7 },
  ];

  return (
    <div className={`ar ${tier}`} role="dialog" aria-modal="true" aria-label="AR mode">
      {tier === "camera" && <video ref={video} className="ar-video" playsInline muted autoPlay />}
      {(tier === "camera" || tier === "view") && (
        <div className="ar-stage">
          <Suspense fallback={<SkeletonShape shape="orb" height="100%" />}>
            <PlanetSystem type="bloom" span={d.clock.span} calendarSpan={Math.max(0, Math.min(1, (d.profile.age - 15) / 36))} moons={moons} />
          </Suspense>
        </div>
      )}
      {tier === "xr" && <XRSession span={d.clock.span} onEnd={() => setTier("choose")} onError={(m) => { setErr(m); setTier("view"); }} />}

      <header className="ar-head">
        <span className="chip">
          <Icon name="ar" size={14} /> {tier === "camera" ? "Lightweight AR · camera" : tier === "view" ? "3D view" : tier === "xr" ? "WebXR" : "AR mode"}
        </span>
        <button
          className="si-close"
          onClick={() => {
            stream.current?.getTracks().forEach((t) => t.stop());
            store.set({ mode: "story" });
          }}
          aria-label="Leave AR (Esc)"
        >
          <Icon name="close" size={18} />
        </button>
      </header>

      {tier === "choose" && (
        <div className="ar-choose glass-thick holo">
          <h2 className="title-md">
            Her Ovarian Clock, <span className="serif grad-text">in your space.</span>
          </h2>
          <p className="small muted">Pick how you'd like to see it. Nothing from your camera is recorded or sent anywhere.</p>
          <div className="ar-opts">
            <button className="glass ar-opt" disabled={!xrOk} onClick={() => setTier("xr")}>
              <Icon name="ar" size={24} />
              <b>Place it in my room</b>
              <span className="small muted">{xrOk == null ? "Checking WebXR…" : xrOk ? "WebXR immersive AR" : "Needs an AR-capable phone (Android Chrome) or headset"}</span>
            </button>
            <button className="glass ar-opt" onClick={startCamera}>
              <Icon name="eye" size={24} />
              <b>Through my camera</b>
              <span className="small muted">Lightweight AR — works on most devices</span>
            </button>
            <button className="glass ar-opt" onClick={() => setTier("view")}>
              <Icon name="cube" size={24} />
              <b>Just the 3D view</b>
              <span className="small muted">No camera needed</span>
            </button>
          </div>
        </div>
      )}

      {(tier === "camera" || tier === "view") && (
        <div className="ar-hud glass">
          <div>
            <span className="faint small">Marker age</span>
            <b className="tnum">{d.clock.markerAge}</b>
          </div>
          <div>
            <span className="faint small">Calendar</span>
            <b className="tnum">{d.clock.calendarAge}</b>
          </div>
          <span className="small muted">{d.clock.verdict}</span>
          <span className="faint small">Drag to spin · pinch to zoom</span>
        </div>
      )}
      {err && (
        <div className="ar-err glass-thin small" role="alert">
          {err}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- WebXR session ---------------------------- */
function XRSession({ span, onEnd, onError }: { span: number; onEnd: () => void; onError: (m: string) => void }) {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const xr = (navigator as unknown as { xr?: { requestSession: (m: string, o: object) => Promise<XRSessionLike> } }).xr;
    if (!xr) {
      onError("WebXR isn't available here.");
      return;
    }
    let renderer: THREE.WebGLRenderer | null = null;
    let session: XRSessionLike | null = null;
    let ended = false;
    (async () => {
      try {
        session = await xr.requestSession("immersive-ar", {
          optionalFeatures: ["dom-overlay", "local-floor"],
          domOverlay: overlay.current ? { root: overlay.current } : undefined,
        });
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.xr.enabled = true;
        renderer.xr.setReferenceSpaceType("local");
        await renderer.xr.setSession(session as never);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        scene.add(new THREE.HemisphereLight(0xffffff, 0xeaa6bc, 2));
        const group = new THREE.Group();
        group.position.set(0, 0, -1.1);
        scene.add(group);
        const planet = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 64, 64),
          new THREE.MeshStandardMaterial({ color: 0xb982a1, roughness: 0.45, metalness: 0.1, emissive: 0x58364f, emissiveIntensity: 0.4 }),
        );
        group.add(planet);
        const atmo = new THREE.Mesh(new THREE.SphereGeometry(0.19, 48, 48), new THREE.MeshBasicMaterial({ color: 0xeaa6bc, transparent: true, opacity: 0.18, side: THREE.BackSide }));
        group.add(atmo);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.004, 8, 160, Math.PI * 1.5 * span), new THREE.MeshBasicMaterial({ color: 0xffd6e4 }));
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        const track = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.0015, 6, 160, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0xeaa6bc, transparent: true, opacity: 0.4 }));
        track.rotation.x = Math.PI / 2;
        group.add(track);
        const moons: THREE.Mesh[] = [];
        for (let i = 0; i < 4; i++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 24, 24), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((330 + i * 18) / 360, 0.5, 0.75) }));
          group.add(m);
          moons.push(m);
        }
        // tap to place the planet 1.1 m in front of where you're looking
        session.addEventListener("select", () => {
          const xrCam = renderer!.xr.getCamera();
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCam.quaternion);
          group.position.copy(xrCam.position).add(dir.multiplyScalar(1.1));
        });
        session.addEventListener("end", () => {
          if (!ended) {
            ended = true;
            onEnd();
          }
        });
        let t = 0;
        renderer.setAnimationLoop(() => {
          t += 0.016;
          planet.rotation.y += 0.004;
          group.rotation.y = Math.sin(t * 0.2) * 0.2;
          moons.forEach((m, i) => {
            const a = t * (0.6 / (1 + i * 0.3)) + i * 1.7;
            const r = 0.22 + i * 0.03;
            m.position.set(Math.cos(a) * r, Math.sin(a * 0.7) * 0.03 * (i - 1.5), Math.sin(a) * r);
          });
          renderer!.render(scene, camera);
        });
      } catch {
        onError("Couldn't start AR here. Showing the 3D view instead.");
      }
    })();
    return () => {
      ended = true;
      renderer?.setAnimationLoop(null);
      session?.end().catch(() => {});
      renderer?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={overlay} className="ar-overlay">
      <div className="ar-hud glass">
        <b>Tap to place her Ovarian Clock</b>
        <span className="small muted">Move your phone slowly to look around it.</span>
      </div>
    </div>
  );
}

interface XRSessionLike {
  addEventListener: (t: string, cb: () => void) => void;
  end: () => Promise<void>;
}
