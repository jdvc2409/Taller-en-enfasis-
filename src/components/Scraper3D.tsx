// Modelo 3D simplificado de la traílla 631G con los puntos coloreados por estado.
// Ejes: x hacia adelante (tractor delante), y hacia arriba, z hacia la derecha del operador. Unidades ≈ m.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PointAnalysis } from '../lib/analysis';
import { STATUS_LABEL } from '../lib/analysis';
import type { Status } from '../types';

const HEX: Record<Status, number> = { critico: 0xd03b3b, alerta: 0xfab219, normal: 0x0ca30c, sin: 0x8e9ba5, ni: 0x5b6670 };

interface Props {
  points: PointAnalysis[];
  pos3d: Record<string, [number, number, number]>;
  highlightZone?: string | null;
  onOpen?: (key: string) => void;
  height?: number;
}

type Tip = { x: number; y: number; p: PointAnalysis } | null;

export default function Scraper3D({ points, pos3d, highlightZone, onOpen, height = 420 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ setZone: (z: string | null) => void; setBowlClear: (b: boolean) => void } | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  const [clear, setClear] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    const el = wrap.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebgl(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, height);
    el.prepend(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, el.clientWidth / height, 0.1, 200);
    camera.position.set(4.2, 5.6, 11.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-1.2, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 7;
    controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = Math.PI * 0.08;
    controls.update();

    scene.add(new THREE.HemisphereLight(0xdfe8ef, 0x2a3036, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbcd2e6, 0.6);
    fill.position.set(-8, 5, -6);
    scene.add(fill);

    const disposables: { dispose: () => void }[] = [];
    const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.28, ...extra });
      disposables.push(m);
      return m;
    };
    const geo = <G extends THREE.BufferGeometry>(g: G) => (disposables.push(g), g);

    const steel = mat(0x6f7b84);
    const dark = mat(0x3a4249);
    const tire = mat(0x1c2024, { roughness: 0.9, metalness: 0 });
    const hoodM = mat(0xc8b06a);
    const glass = mat(0x9fc3dd, { transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1 });
    const zoneMat: Record<string, THREE.MeshStandardMaterial> = {
      BW: mat(0x7c8892, { side: THREE.DoubleSide }),
      AP: mat(0x86929b, { side: THREE.DoubleSide }),
      EY: mat(0x66737c, { side: THREE.DoubleSide }),
    };
    const groups: Record<string, THREE.Group> = { BW: new THREE.Group(), AP: new THREE.Group(), EY: new THREE.Group() };
    Object.values(groups).forEach((g) => scene.add(g));
    const root = new THREE.Group();
    scene.add(root);

    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = root) => {
      const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const tube = (a: number[], b: number[], r: number, m: THREE.Material, parent: THREE.Object3D = root) => {
      const va = new THREE.Vector3(...a);
      const vb = new THREE.Vector3(...b);
      const len = va.distanceTo(vb);
      const mesh = new THREE.Mesh(geo(new THREE.CylinderGeometry(r, r, len, 14)), m);
      mesh.position.copy(va).add(vb).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      parent.add(mesh);
      return mesh;
    };
    const wheel = (x: number, z: number, r: number, w: number) => {
      const t = new THREE.Mesh(geo(new THREE.CylinderGeometry(r, r, w, 32)), tire);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, r, z);
      root.add(t);
      const hub = new THREE.Mesh(geo(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.04, 20)), hoodM);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(x, r, z);
      root.add(hub);
    };

    // Suelo
    const grid = new THREE.GridHelper(30, 30, 0x55636d, 0x39444c);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    disposables.push(grid.geometry, grid.material as THREE.Material);
    scene.add(grid);

    // Tractor delantero
    wheel(5.6, 1.78, 1.0, 0.8);
    wheel(5.6, -1.78, 1.0, 0.8);
    box(3.6, 0.5, 1.2, 5.3, 1.15, 0, dark);
    box(2.2, 1.25, 1.65, 6.2, 1.85, 0, hoodM);
    box(1.4, 1.3, 1.5, 4.7, 3.05, 0, glass);
    box(1.6, 0.1, 1.7, 4.7, 3.75, 0, hoodM);
    box(1.5, 0.45, 1.6, 4.7, 2.2, 0, hoodM);
    tube([3.7, 1.0, 0], [3.7, 2.1, 0], 0.18, dark);

    // Gooseneck y brazos de tiro
    tube([3.7, 1.9, 0], [3.2, 3.3, 0], 0.22, steel);
    tube([3.2, 3.3, 0], [1.7, 3.35, 0], 0.22, steel);
    for (const s of [1, -1]) {
      tube([1.7, 3.3, 0.35 * s], [0, 2.75, 1.95 * s], 0.13, steel);
      tube([0, 2.75, 1.95 * s], [-1.7, 1.55, 1.95 * s], 0.13, steel);
    }

    // Caja (BW)
    const bw = groups.BW;
    for (const s of [1, -1]) {
      box(6.2, 2.4, 0.12, -2.9, 1.7, 1.75 * s, zoneMat.BW, bw);
      box(6.2, 0.18, 0.2, -2.9, 2.95, 1.78 * s, zoneMat.BW, bw);
      box(6.2, 0.2, 0.2, -2.9, 0.5, 1.78 * s, zoneMat.BW, bw);
    }
    box(6.2, 0.12, 3.5, -2.9, 0.5, 0, zoneMat.BW, bw);
    box(0.12, 2.4, 3.5, -6.0, 1.7, 0, zoneMat.BW, bw);
    tube([-1.4, 2.95, -1.8], [-1.4, 2.95, 1.8], 0.12, zoneMat.BW, bw);

    // Apron (AP): compuerta curva que cierra el frente
    const ap = groups.AP;
    const curve = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.5, 1.5, 3.5, 28, 1, true, 0, Math.PI / 2)), zoneMat.AP);
    curve.rotation.x = Math.PI / 2;
    curve.position.set(0.1, 2.0, 0);
    ap.add(curve);
    box(0.08, 0.9, 3.5, 1.6, 2.45, 0, zoneMat.AP, ap);
    for (const s of [1, -1]) {
      const q = new THREE.Mesh(geo(new THREE.CircleGeometry(1.5, 24, -Math.PI / 2, Math.PI / 2)), zoneMat.AP);
      q.position.set(0.1, 2.0, 1.76 * s);
      ap.add(q);
      const r = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.5, 0.9)), zoneMat.AP);
      r.position.set(0.85, 2.45, 1.76 * s);
      ap.add(r);
      tube([1.45, 2.8, 1.8 * s], [0.2, 2.45, 1.9 * s], 0.08, zoneMat.AP, ap);
    }
    box(0.28, 0.36, 0.14, 1.75, 2.85, 0, zoneMat.AP, ap);
    tube([1.75, 2.95, 0], [2.7, 3.32, 0], 0.07, dark, ap);

    // Eyector (EY)
    const ey = groups.EY;
    box(0.1, 2.2, 3.3, -4.4, 1.65, 0, zoneMat.EY, ey);
    for (const s of [1, -1]) tube([-4.4, 1.3, 0.9 * s], [-6.5, 1.15, 0.9 * s], 0.09, zoneMat.EY, ey);
    tube([-4.4, 1.65, 0], [-6.3, 1.4, 0], 0.1, zoneMat.EY, ey);

    // Tractor trasero
    wheel(-5.2, 1.98, 1.0, 0.7);
    wheel(-5.2, -1.98, 1.0, 0.7);
    box(1.6, 1.2, 1.4, -6.9, 1.6, 0, hoodM);
    box(0.4, 0.6, 1.2, -7.9, 1.2, 0, dark);

    // Puntos
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sphereG = geo(new THREE.SphereGeometry(0.17, 20, 14));
    const haloG = geo(new THREE.SphereGeometry(0.17, 20, 14));
    const markers: { mesh: THREE.Mesh; halo?: THREE.Mesh; p: PointAnalysis; label: HTMLDivElement }[] = [];
    const labelsEl = labelsRef.current!;
    labelsEl.innerHTML = '';
    for (const p of points) {
      const pos = pos3d[p.point.code];
      if (!pos) continue;
      const m = mat(HEX[p.status], { emissive: HEX[p.status], emissiveIntensity: 0.35, roughness: 0.4, metalness: 0 });
      const mesh = new THREE.Mesh(sphereG, m);
      mesh.position.set(...pos);
      mesh.userData.key = p.point.key;
      scene.add(mesh);
      let halo: THREE.Mesh | undefined;
      if (p.status === 'alerta' || p.status === 'critico') {
        const hm = new THREE.MeshBasicMaterial({ color: HEX[p.status], transparent: true, opacity: 0.25, depthWrite: false });
        disposables.push(hm);
        halo = new THREE.Mesh(haloG, hm);
        halo.position.copy(mesh.position);
        halo.scale.setScalar(1.9);
        scene.add(halo);
      }
      const label = document.createElement('div');
      label.textContent = p.point.code;
      label.className = 'lbl3d';
      labelsEl.appendChild(label);
      markers.push({ mesh, halo, p, label });
    }

    // Interacción
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const hit = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const h = ray.intersectObjects(markers.map((m) => m.mesh))[0];
      return h ? markers.find((m) => m.mesh === h.object) ?? null : null;
    };
    const onMove = (e: PointerEvent) => {
      const m = hit(e);
      renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
      const r = el.getBoundingClientRect();
      setTip(m ? { x: e.clientX - r.left, y: e.clientY - r.top, p: m.p } : null);
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const m = hit(e);
        if (m) openRef.current?.(m.p.point.key);
      }
      down = null;
    };
    const onLeave = () => setTip(null);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    api.current = {
      setZone: (z) => {
        for (const [id, m] of Object.entries(zoneMat)) {
          m.emissive.setHex(id === z ? 0x2f6fa3 : 0x000000);
          m.emissiveIntensity = id === z ? 0.55 : 0;
        }
      },
      setBowlClear: (b) => {
        zoneMat.BW.transparent = b;
        zoneMat.BW.opacity = b ? 0.18 : 1;
        zoneMat.BW.depthWrite = !b;
        zoneMat.BW.needsUpdate = true;
      },
    };

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      renderer.setSize(w, height);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    let raf = 0;
    const v = new THREE.Vector3();
    const tick = (t: number) => {
      controls.update();
      for (const m of markers) {
        if (m.halo && !reduce) {
          const k = 1.6 + 0.6 * (0.5 + 0.5 * Math.sin(t / (m.p.status === 'critico' ? 260 : 420)));
          m.halo.scale.setScalar(k);
          (m.halo.material as THREE.MeshBasicMaterial).opacity = 0.32 - (k - 1.6) * 0.3;
        }
        v.copy(m.mesh.position).project(camera);
        const x = (v.x * 0.5 + 0.5) * el.clientWidth;
        const y = (-v.y * 0.5 + 0.5) * height;
        m.label.style.transform = `translate(${x + 9}px, ${y - 22}px)`;
        m.label.style.display = v.z < 1 ? 'block' : 'none';
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labelsEl.innerHTML = '';
      api.current = null;
    };
  }, [points, pos3d, height]);

  useEffect(() => api.current?.setZone(highlightZone ?? null), [highlightZone, points]);
  useEffect(() => api.current?.setBowlClear(clear), [clear, points]);

  if (!webgl) return <div className="empty">Este navegador no tiene WebGL: el modelo 3D no está disponible.</div>;
  return (
    <div>
      <div ref={wrap} style={{ position: 'relative', height, borderRadius: 8, overflow: 'hidden', background: 'var(--sup2)' }}>
        <div ref={labelsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden="true" />
        <div className="tiny muted" style={{ position: 'absolute', left: 10, bottom: 8, pointerEvents: 'none' }}>
          Representación simplificada · arrastre para girar, rueda para acercar
        </div>
        {tip && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              left: Math.min(tip.x + 14, (wrap.current?.clientWidth ?? 400) - 250),
              top: Math.max(tip.y - 10, 8),
              width: 236,
              background: 'var(--sup)',
              border: '1px solid var(--linea2)',
              borderRadius: 8,
              padding: '9px 11px',
              fontSize: 13,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontFamily: 'var(--fuente-c)', fontWeight: 700, fontSize: 16 }}>
              {tip.p.point.code} · {STATUS_LABEL[tip.p.status]}
            </div>
            <div className="muted">{tip.p.point.description}</div>
            <div className="tab" style={{ marginTop: 4 }}>
              L {tip.p.length ?? 'N/I'} mm · C {tip.p.point.caution} · D {tip.p.point.danger}
            </div>
            <div className="tiny muted" style={{ marginTop: 3 }}>
              Clic para abrir el punto
            </div>
          </div>
        )}
      </div>
      <label className="check small" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} />
        Caja transparente (para ver el eyector)
      </label>
    </div>
  );
}
