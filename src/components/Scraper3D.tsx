// Modelo 3D simplificado de la traílla 631G con los puntos coloreados por estado.
// Ejes: x hacia adelante (tractor delante), y hacia arriba, z hacia la derecha del operador. Unidades ≈ m.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildScraper } from './scraperModel';
import type { PointAnalysis } from '../lib/analysis';
import { STATUS_LABEL } from '../lib/analysis';
import type { Status } from '../types';

const HEX: Record<Status, number> = { critico: 0xd2261c, alerta: 0xff7a00, normal: 0x0b9c8c, sin: 0xf2f4f6, ni: 0x8a949c };

interface Props {
  points: PointAnalysis[];
  pos3d: Record<string, [number, number, number]>;
  highlightZone?: string | null;
  onOpen?: (key: string) => void;
  height?: number;
  /** Entrada animada: la cámara llega volando y la traílla gira despacio hasta que alguien la toca. */
  intro?: boolean;
  autoRotate?: boolean;
  /** Lleva la cámara a una zona (Caja, Apron o Eyector) y la resalta. */
  focus?: 'BW' | 'AP' | 'EY' | null;
  /** Sin la casilla de caja transparente (para la portada). */
  bare?: boolean;
}

type Zone = 'BW' | 'AP' | 'EY';
/** Vistas de cámara por zona: [objetivo, posición] en metros. */
const VIEWS: Record<Zone, [[number, number, number], [number, number, number]]> = {
  AP: [[0.8, 1.3, 0], [3.2, 3.9, -7.6]],
  BW: [[-1.0, 1.4, 0], [1.2, 6.2, -10.5]],
  EY: [[-2.4, 1.4, 0], [2.6, 7.6, 5.2]],
};
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Tip = { x: number; y: number; p: PointAnalysis } | null;

export default function Scraper3D({ points, pos3d, highlightZone, onOpen, height = 420, intro, autoRotate, focus, bare }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ setZone: (z: string | null) => void; setBowlClear: (b: boolean) => void; focus: (z: Zone | null) => void } | null>(null);
  const motion = useRef({ intro, autoRotate });
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
    const camera = new THREE.PerspectiveCamera(34, el.clientWidth / height, 0.1, 200);
    camera.position.set(7.4, 5.0, 12.0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.6, 1.7, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 7;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = Math.PI * 0.08;
    // Encuadre: en paneles angostos la cámara se aleja para que quepa la traílla completa.
    const baseOffset = camera.position.clone().sub(controls.target);
    const homeTarget = controls.target.clone();
    let k = 1;
    const fit = (aspect: number) => {
      k = Math.max(1, Math.pow(2.3 / aspect, 0.85));
      if (!tw) camera.position.copy(controls.target).add(baseOffset.clone().multiplyScalar(k));
    };
    // Animación de cámara (entrada y enfoque de zonas).
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let tw: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number } | null = null;
    const flyTo = (t1: THREE.Vector3, p1: THREE.Vector3, dur = 1300) => {
      if (reduced) {
        controls.target.copy(t1);
        camera.position.copy(p1);
        return;
      }
      tw = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, start: performance.now(), dur };
    };
    const homePos = () => homeTarget.clone().add(baseOffset.clone().multiplyScalar(k));
    fit(el.clientWidth / height);
    if (motion.current.intro && !reduced) {
      const far = baseOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.25).multiplyScalar(k * 1.9);
      far.y += 4;
      camera.position.copy(homeTarget).add(far);
      flyTo(homeTarget.clone(), homePos(), 2600);
    }
    controls.autoRotate = !!motion.current.autoRotate && !reduced;
    controls.autoRotateSpeed = 0.55;
    let idle: ReturnType<typeof setTimeout> | undefined;
    controls.addEventListener('start', () => {
      tw = null;
      controls.autoRotate = false;
      clearTimeout(idle);
    });
    controls.addEventListener('end', () => {
      if (motion.current.autoRotate && !reduced) idle = setTimeout(() => (controls.autoRotate = true), 9000);
    });
    controls.update();

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const disposables: { dispose: () => void }[] = [];
    const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.28, ...extra });
      disposables.push(m);
      return m;
    };
    const geo = <G extends THREE.BufferGeometry>(g: G) => (disposables.push(g), g);

    // Luz de estudio: entorno para reflejos, sol con sombras suaves y relleno frío.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.65;
    disposables.push(envTex, pmrem);
    scene.add(new THREE.HemisphereLight(0xeef3f7, 0x3a3f44, 0.35));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.7);
    sun.position.set(7, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -11;
    sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc9dcec, 0.7);
    fill.position.set(-9, 6, -7);
    scene.add(fill);

    // Piso: solo la sombra y una rejilla tenue que se desvanece.
    const ground = new THREE.Mesh(geo(new THREE.CircleGeometry(16, 64)), new THREE.ShadowMaterial({ opacity: 0.22 }));
    disposables.push(ground.material as THREE.Material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(28, 28, 0x7a8790, 0x7a8790);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.12;
    grid.position.y = 0.002;
    disposables.push(grid.geometry, grid.material as THREE.Material);
    scene.add(grid);

    const model = buildScraper();
    disposables.push(model);
    scene.add(model.root);
    // Solo la pintura propia de cada zona se resalta o se vuelve transparente (los pernos y el bastidor se comparten).
    const zoneMats: Record<string, THREE.MeshPhysicalMaterial[]> = Object.fromEntries(Object.entries(model.zonePaint).map(([k, m]) => [k, [m]]));

    // Puntos
    const sphereG = geo(new THREE.SphereGeometry(0.15, 24, 16));
    const haloG = geo(new THREE.SphereGeometry(0.15, 24, 16));
    const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
    disposables.push(ringM);
    const markers: { mesh: THREE.Mesh; halo?: THREE.Mesh; p: PointAnalysis; label: HTMLDivElement }[] = [];
    const labelsEl = labelsRef.current!;
    labelsEl.innerHTML = '';
    for (const p of points) {
      const pos = pos3d[p.point.code];
      if (!pos) continue;
      const m = mat(HEX[p.status], { emissive: HEX[p.status], emissiveIntensity: 0.45, roughness: 0.35, metalness: 0 });
      const mesh = new THREE.Mesh(sphereG, m);
      mesh.position.set(...pos);
      mesh.userData.key = p.point.key;
      scene.add(mesh);
      // Contorno blanco para que el punto se lea sobre la pintura amarilla.
      const halo = new THREE.Mesh(haloG, ringM);
      halo.position.copy(mesh.position);
      halo.scale.setScalar(1.35);
      scene.add(halo);
      const label = document.createElement('div');
      label.textContent = p.point.code;
      label.className = `lbl3d lbl3d-${p.status}`;
      if (p.status === 'critico' || p.status === 'alerta') {
        mesh.scale.setScalar(1.45);
        halo.scale.setScalar(1.45 * 1.35);
      }
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
        zoneOn = z;
        for (const [id, ms] of Object.entries(zoneMats))
          for (const m of ms) {
            if (!m.emissive) continue;
            m.emissive.setHex(id === z ? 0xff8a00 : 0x000000);
            m.emissiveIntensity = id === z ? 0.3 : 0;
          }
      },
      focus: (z) => {
        api.current?.setZone(z);
        clearTimeout(idle);
        if (z) {
          controls.autoRotate = false;
          const [t, p] = VIEWS[z];
          const tv = new THREE.Vector3(...t);
          flyTo(tv, tv.clone().add(new THREE.Vector3(...p).sub(tv).multiplyScalar(k)));
        } else {
          flyTo(homeTarget.clone(), homePos());
          if (motion.current.autoRotate && !reduced) idle = setTimeout(() => (controls.autoRotate = true), 2500);
        }
      },
      setBowlClear: (b) => {
        model.zones.BW.traverse((o) => {
          if (o.userData.edge) o.visible = !b;
        });
        for (const m of zoneMats.BW ?? []) {
          m.transparent = b;
          m.opacity = b ? 0.15 : 1;
          m.depthWrite = !b;
          m.needsUpdate = true;
        }
      },
    };

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      renderer.setSize(w, height);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      fit(w / height);
    });
    ro.observe(el);

    let raf = 0;
    let frame = 0;
    const v = new THREE.Vector3();
    const occ = new THREE.Raycaster();
    const solids: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !markers.some((m) => m.mesh === o || m.halo === o)) solids.push(o);
    });
    let zoneOn: string | null = null;
    const tick = () => {
      if (tw) {
        const t = Math.min(1, (performance.now() - tw.start) / tw.dur);
        const e = ease(t);
        camera.position.lerpVectors(tw.p0, tw.p1, e);
        controls.target.lerpVectors(tw.t0, tw.t1, e);
        if (t >= 1) tw = null;
      }
      controls.update();
      // Cada pocos cuadros, las etiquetas de puntos tapados por la estructura se atenúan.
      if (frame++ % 6 === 0) {
        for (const m of markers) {
          const dir = m.mesh.position.clone().sub(camera.position);
          const dist = dir.length();
          occ.set(camera.position, dir.normalize());
          occ.far = dist - 0.4;
          const hidden = occ.intersectObjects(solids, false).some((h) => {
            const mt = (h.object as THREE.Mesh).material as THREE.Material;
            return !(mt.transparent && mt.opacity < 0.5);
          });
          m.label.style.opacity = hidden ? '0.35' : '1';
        }
      }
      for (const m of markers) {
        v.copy(m.mesh.position).project(camera);
        const x = (v.x * 0.5 + 0.5) * el.clientWidth;
        const y = (-v.y * 0.5 + 0.5) * height;
        m.label.style.transform = `translate(${x + 9}px, ${y - 22}px)`;
        // Solo se rotulan los puntos con grieta; los demás se identifican al pasar el mouse.
        const quiet = (m.p.status === 'sin' || m.p.status === 'ni') && m.p.point.zone !== zoneOn;
        m.label.style.display = v.z < 1 && !quiet ? 'block' : 'none';
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
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
  useEffect(() => {
    if (focus !== undefined) api.current?.focus(focus);
  }, [focus]);

  if (!webgl) return <div className="empty">Este navegador no tiene WebGL: el modelo 3D no está disponible.</div>;
  return (
    <div>
      <div ref={wrap} className={bare ? 'viewer bare' : 'viewer'} style={{ position: 'relative', height, borderRadius: 8, overflow: 'hidden' }}>
        <div ref={labelsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden="true" />
        <div className="tiny muted" style={{ position: 'absolute', left: 10, bottom: 8, pointerEvents: 'none' }}>
          Arrastra para girar · rueda para acercar
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
            <div style={{ fontFamily: 'var(--fuente)', fontWeight: 600, fontSize: 16 }}>
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
      {!bare && (
      <label className="check small" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} />
        Caja transparente (para ver el eyector)
      </label>
      )}
    </div>
  );
}
