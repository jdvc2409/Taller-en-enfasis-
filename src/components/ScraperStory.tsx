// Recorrido por scroll de la portada: la traílla se desarma en las tres zonas que se inspeccionan (vista explosionada),
// la cámara pasa por cada zona mostrando el estado real de sus puntos y al final se vuelve a armar.
// Solo lee el análisis que ya hizo la plataforma: no calcula ni cambia ningún dato.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildScraper } from './scraperModel';
import { STATUS_LABEL, worst, type PointAnalysis } from '../lib/analysis';
import { href, navigate } from '../router';
import { Icon, StatusIcon, StatusPill, fmt } from './ui';
import type { Status, Zone as ZoneInfo } from '../types';

type ZoneId = 'BW' | 'AP' | 'EY';
type V3 = [number, number, number];

interface Props {
  points: PointAnalysis[];
  pos3d: Record<string, [number, number, number]>;
  zones: ZoneInfo[];
  unitLabel: string;
}

const HEX: Record<Status, number> = { critico: 0xd2261c, alerta: 0xff7a00, normal: 0x0b9c8c, sin: 0xf2f4f6, ni: 0x8a949c };

/** Cuánto se separa cada zona en la vista explosionada (m) y con qué retraso arranca (0..1). */
const EXPLODE: Record<ZoneId, { off: V3; delay: number }> = {
  BW: { off: [0, 2.7, 0], delay: 0 },
  AP: { off: [2.3, 3.7, 0], delay: 0.18 },
  EY: { off: [-2.7, 2.7, 0], delay: 0.36 },
};

/** Cuadros clave de la cámara a lo largo del scroll: p = avance 0..1, ex = cuánto está desarmada. */
const KEYS: { p: number; pos: V3; tgt: V3; ex: number }[] = [
  { p: 0.0, pos: [7.8, 4.6, 12.6], tgt: [0.4, 1.6, 0], ex: 0 },
  { p: 0.12, pos: [7.4, 5.6, 13.2], tgt: [0.3, 1.7, 0], ex: 0 },
  { p: 0.32, pos: [9.5, 8.6, 15.5], tgt: [-0.4, 3.6, 0], ex: 1 },
  { p: 0.4, pos: [5.2, 9.6, 10.2], tgt: [-1.1, 4.2, 0], ex: 1 },
  { p: 0.52, pos: [4.2, 9.2, 9.2], tgt: [-1.1, 4.2, 0], ex: 1 },
  { p: 0.6, pos: [7.8, 7.4, 6.2], tgt: [2.7, 5.2, 0], ex: 1 },
  { p: 0.7, pos: [8.4, 6.6, 4.6], tgt: [2.7, 5.2, 0], ex: 1 },
  { p: 0.78, pos: [-2.4, 7.4, 7.8], tgt: [-4.4, 4.0, 0], ex: 1 },
  { p: 0.87, pos: [-1.4, 7.2, 8.6], tgt: [-4.4, 4.0, 0], ex: 1 },
  { p: 0.96, pos: [7.4, 5.6, 13.2], tgt: [0.3, 1.7, 0], ex: 0 },
  { p: 1.0, pos: [7.4, 5.6, 13.2], tgt: [0.3, 1.7, 0], ex: 0 },
];

/** Pasos del texto: desde qué avance se muestra cada uno. */
const STEPS: { from: number; zone: ZoneId | null }[] = [
  { from: 0, zone: null },
  { from: 0.18, zone: null },
  { from: 0.36, zone: 'BW' },
  { from: 0.56, zone: 'AP' },
  { from: 0.74, zone: 'EY' },
  { from: 0.91, zone: null },
];
const STEP_NAMES = ['Completa', 'Desarmada', 'Caja', 'Apron', 'Eyector', 'Hoy'];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (t: number) => t * t * (3 - 2 * t);
const stepAt = (p: number) => STEPS.reduce((acc, s, i) => (p >= s.from ? i : acc), 0);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Estado de cámara y separación interpolado para un avance p. */
function sample(p: number) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(clamp((p - a.p) / (b.p - a.p)));
  const lerp3 = (u: V3, v: V3) => new THREE.Vector3(u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, u[2] + (v[2] - u[2]) * t);
  return { pos: lerp3(a.pos, b.pos), tgt: lerp3(a.tgt, b.tgt), ex: a.ex + (b.ex - a.ex) * t };
}

export default function ScraperStory({ points, pos3d, zones, unitLabel }: Props) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [reduced] = useState(reducedMotion);
  const stepRef = useRef(0);

  const byZone = useMemo(() => {
    const out = {} as Record<ZoneId, { info?: ZoneInfo; pts: PointAnalysis[]; worst: Status }>;
    for (const id of ['BW', 'AP', 'EY'] as ZoneId[]) {
      const pts = points.filter((p) => p.point.zone === id);
      out[id] = { info: zones.find((z) => z.id === id), pts, worst: worst(pts.map((p) => p.status)) };
    }
    return out;
  }, [points, zones]);

  useEffect(() => {
    const el = stage.current!;
    const sec = section.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebgl(false);
      return;
    }
    const size = () => [Math.max(1, el.clientWidth), Math.max(1, el.clientHeight)] as const;
    let [W, H] = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(renderer.domElement);
    renderer.domElement.className = 'story-canvas';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
    const disposables: { dispose: () => void }[] = [];

    // Luz de estudio, igual que el visor 3D de la plataforma.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.65;
    disposables.push(envTex, pmrem);
    scene.add(new THREE.HemisphereLight(0xeef3f7, 0x3a3f44, 0.35));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.7);
    sun.position.set(7, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 45 });
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc9dcec, 0.7);
    fill.position.set(-9, 6, -7);
    scene.add(fill);

    const groundG = new THREE.CircleGeometry(18, 64);
    const groundM = new THREE.ShadowMaterial({ opacity: 0.2 });
    const ground = new THREE.Mesh(groundG, groundM);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(30, 30, 0x7a8790, 0x7a8790);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.12;
    grid.position.y = 0.002;
    scene.add(grid);
    disposables.push(groundG, groundM, grid.geometry, grid.material as THREE.Material);

    const model = buildScraper();
    disposables.push(model);
    scene.add(model.root);

    // Pintura: la de cada zona y la del resto de la máquina (tractor y bastidor), para atenuar lo que no está en foco.
    const yellow = new THREE.Color(0xd59a12);
    const grey = new THREE.Color(0x9aa1a7);
    const zonePaints = new Set<THREE.Material>(Object.values(model.zonePaint));
    let basePaint: THREE.MeshPhysicalMaterial | null = null;
    model.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (!basePaint && m?.isMeshPhysicalMaterial && !zonePaints.has(m) && m.color.getHex() === yellow.getHex()) basePaint = m;
    });

    // Puntos de inspección: cuelgan de su zona para viajar con ella al desarmarse.
    const sphereG = new THREE.SphereGeometry(0.15, 24, 16);
    const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
    disposables.push(sphereG, ringM);
    const markers: { mesh: THREE.Mesh; p: PointAnalysis; zone: ZoneId; label: HTMLDivElement }[] = [];
    const labelsEl = labelsRef.current!;
    labelsEl.innerHTML = '';
    for (const p of points) {
      const pos = pos3d[p.point.code];
      const zone = p.point.zone as ZoneId;
      const group = model.zones[zone];
      if (!pos || !group) continue;
      const m = new THREE.MeshStandardMaterial({ color: HEX[p.status], emissive: HEX[p.status], emissiveIntensity: 0.45, roughness: 0.35, metalness: 0 });
      disposables.push(m);
      const mesh = new THREE.Mesh(sphereG, m);
      mesh.position.set(...pos);
      const big = p.status === 'critico' || p.status === 'alerta';
      mesh.scale.setScalar(big ? 1.45 : 1);
      const halo = new THREE.Mesh(sphereG, ringM);
      halo.scale.setScalar(1.35);
      mesh.add(halo);
      group.add(mesh);
      const label = document.createElement('div');
      label.className = `lbl3d lbl3d-${p.status}`;
      label.textContent = p.point.code;
      labelsEl.appendChild(label);
      markers.push({ mesh, p, zone, label });
    }

    // Clic en un punto: abre su página.
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const hit = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const h = ray.intersectObjects(markers.map((m) => m.mesh), false)[0];
      return h ? markers.find((m) => m.mesh === h.object) ?? null : null;
    };
    const onMove = (e: PointerEvent) => (renderer.domElement.style.cursor = hit(e) ? 'pointer' : 'default');
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const m = hit(e);
        if (m) navigate(href.punto(m.p.point.key));
      }
      down = null;
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // Avance del scroll dentro de la sección (0 al entrar fijada, 1 al soltarse).
    const target = () => {
      if (reduced) return 0.3;
      const r = sec.getBoundingClientRect();
      const run = r.height - el.clientHeight;
      const stick = parseFloat(getComputedStyle(el).top) || 0;
      return run > 0 ? clamp((stick - r.top) / run) : 0;
    };
    let p = target();
    let shown = -1;
    const focusW: Record<ZoneId | 'base', number> = { BW: 1, AP: 1, EY: 1, base: 1 };

    // Encuadre: en pantallas angostas se aleja la cámara; en anchas, la traílla se corre a la derecha para dejar sitio al texto.
    const layout = () => {
      [W, H] = size();
      renderer.setSize(W, H);
      camera.aspect = W / H;
      const wide = W >= 900;
      if (wide) camera.setViewOffset(W, H, -W * 0.1, 0, W, H);
      else camera.setViewOffset(W, H, 0, H * 0.16, W, H);
      camera.updateProjectionMatrix();
      shown = -1;
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);

    const v = new THREE.Vector3();
    const draw = (a: number) => {
      const s = sample(p);
      const aspect = W / H;
      const k = Math.max(1, Math.pow((W >= 900 ? 2.95 : 1.5) / aspect, 0.8));
      camera.position.copy(s.tgt).add(s.pos.clone().sub(s.tgt).multiplyScalar(k));
      camera.lookAt(s.tgt);

      for (const id of ['BW', 'AP', 'EY'] as ZoneId[]) {
        const { off, delay } = EXPLODE[id];
        const e = smooth(clamp((s.ex - delay) / (1 - 0.36)));
        model.zones[id].position.set(off[0] * e, off[1] * e, off[2] * e);
      }

      const st = stepAt(p);
      if (st !== stepRef.current) {
        stepRef.current = st;
        setStep(st);
      }
      const focus = STEPS[st].zone;
      let settling = false;
      for (const id of ['BW', 'AP', 'EY', 'base'] as const) {
        const goal = focus == null || focus === id ? 1 : 0.06;
        const cur = focusW[id];
        const next = reduced ? goal : cur + (goal - cur) * Math.min(1, a * 1.2);
        focusW[id] = Math.abs(goal - next) < 0.003 ? goal : next;
        if (focusW[id] !== goal) settling = true;
        const mat = id === 'base' ? basePaint : model.zonePaint[id];
        if (mat) {
          mat.color.copy(grey).lerp(yellow, focusW[id]);
          mat.emissive.setHex(focus === id ? 0x6a3c00 : 0x000000);
          mat.emissiveIntensity = focus === id ? 0.35 : 0;
        }
      }

      for (const m of markers) {
        m.mesh.getWorldPosition(v);
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * W;
        const y = (-v.y * 0.5 + 0.5) * H;
        const inFocus = focus === m.zone;
        const loud = m.p.status === 'critico' || m.p.status === 'alerta';
        const show = v.z < 1 && (inFocus || (focus == null && loud && st !== 0));
        m.label.style.display = show ? 'block' : 'none';
        m.label.style.transform = `translate(${x + 9}px, ${y - 22}px)`;
        m.mesh.visible = focus == null || inFocus;
      }
      renderer.render(scene, camera);
      return settling;
    };

    // Se dibuja solo mientras la sección está en pantalla y algo cambia; el avance se suaviza para que se sienta fluido.
    let raf = 0;
    let visible = false;
    let last = 0;
    const tick = (now: number) => {
      raf = 0;
      if (!visible) return;
      // Suavizado por tiempo (≈ 0,15 s), igual en pantallas de 60 o 144 Hz.
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      const a = 1 - Math.exp(-dt / 0.15);
      const goal = target();
      const next = reduced ? goal : p + (goal - p) * a;
      const moving = Math.abs(goal - next) > 0.0004;
      p = moving ? next : goal;
      const settling = draw(a);
      if (moving || settling || shown !== p) {
        shown = moving || settling ? -1 : p;
        raf = requestAnimationFrame(tick);
      } else last = 0;
    };
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        shown = -1;
        kick();
      }
    });
    io.observe(sec);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    const ro2 = new ResizeObserver(kick);
    ro2.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      ro2.disconnect();
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labelsEl.innerHTML = '';
    };
  }, [points, pos3d, reduced]);

  const crit = points.filter((p) => p.status === 'critico').length;
  const alert = points.filter((p) => p.status === 'alerta').length;
  const cracked = points.filter((p) => p.hasCrack).length;
  const zoneName = (id: ZoneId) => byZone[id].info?.name.split(' (')[0] ?? id;

  const zoneCard = (id: ZoneId, n: number) => {
    const z = byZone[id];
    const top = [...z.pts].sort((a, b) => b.score - a.score)[0];
    return (
      <>
        <div className="story-k">
          {n} · Zona {id}
        </div>
        <h3 className="story-t">
          <StatusIcon status={z.worst} size={18} /> {z.info?.name ?? id}
        </h3>
        <p className="story-p">
          {z.pts.length} puntos de control · consecuencia {z.info?.criticality ?? '—'} de 5. {z.info?.reason}
        </p>
        <ul className="story-pts">
          {z.pts.map((p) => (
            <li key={p.point.key}>
              <a href={href.punto(p.point.key)}>
                <b>{p.point.code}</b>
                <span className="story-desc">{p.point.description}</span>
                <span className="story-len tab">{p.length == null ? 'N/I' : `${fmt(p.length)} mm`}</span>
                <StatusPill status={p.status} />
              </a>
            </li>
          ))}
        </ul>
        {top && top.hasCrack && (
          <p className="story-note">
            Lo más urgente aquí: <b>{top.point.code}</b>, {STATUS_LABEL[top.status].toLowerCase()}
            {top.length != null && (
              <>
                {' '}
                con {fmt(top.length)} mm (Danger {fmt(top.point.danger)} mm)
              </>
            )}
            .
          </p>
        )}
      </>
    );
  };

  const cards = [
    <>
      <div className="story-k">Recorrido · {unitLabel}</div>
      <h3 className="story-t big">Así se inspecciona una traílla.</h3>
      <p className="story-p">Baja con la rueda del mouse: la máquina se desarma en las tres zonas donde se miden las grietas y te muestra cómo está cada una hoy.</p>
    </>,
    <>
      <div className="story-k">Vista explosionada</div>
      <h3 className="story-t">Tres zonas, {points.length} puntos de control</h3>
      <p className="story-p">
        El tractor y el bastidor quedan quietos. Se separan las piezas que se inspeccionan: <b>{zoneName('BW')}</b>, <b>{zoneName('AP')}</b> y <b>{zoneName('EY')}</b>.
      </p>
      <div className="story-legend">
        {(['BW', 'AP', 'EY'] as ZoneId[]).map((id) => (
          <span key={id}>
            <StatusIcon status={byZone[id].worst} size={12} /> {zoneName(id)} · {byZone[id].pts.length}
          </span>
        ))}
      </div>
    </>,
    zoneCard('BW', 1),
    zoneCard('AP', 2),
    zoneCard('EY', 3),
    <>
      <div className="story-k">El resultado</div>
      <h3 className="story-t">
        {cracked} de {points.length} puntos {cracked === 1 ? 'tiene' : 'tienen'} grieta
      </h3>
      <p className="story-p">
        {crit > 0 && (
          <>
            <b className="story-crit">
              {crit} {crit === 1 ? 'está crítico' : 'están críticos'}
            </b>{' '}
            y no permiten operar.{' '}
          </>
        )}
        {alert > 0 && (
          <>
            {alert} {alert === 1 ? 'está en alerta' : 'están en alerta'}.{' '}
          </>
        )}
        La plataforma los ordena por urgencia y consecuencia.
      </p>
      <div className="row" style={{ marginTop: 14 }}>
        <a className="btn primary" href={href.flota()}>
          Ver qué reparar primero
          <Icon name="right" />
        </a>
      </div>
    </>,
  ];

  if (!webgl) return null;

  return (
    <section ref={section} className={reduced ? 'story still' : 'story'} aria-label="Recorrido por las zonas de la traílla">
      <div ref={stage} className="story-stage">
        <div ref={labelsRef} className="story-labels" aria-hidden="true" />
        {!reduced && (
          <>
            <div className="story-cards">
              {cards.map((c, i) => (
                <div key={i} className={`story-card${i === step ? ' on' : i < step ? ' past' : ''}`} aria-hidden={i !== step}>
                  {c}
                </div>
              ))}
            </div>
            <ol className="story-rail" aria-hidden="true">
              {STEP_NAMES.map((n, i) => (
                <li key={n} className={i === step ? 'on' : i < step ? 'past' : ''}>
                  <span>{n}</span>
                </li>
              ))}
            </ol>
            <div className={`story-hint${step === 0 ? '' : ' off'}`} aria-hidden="true">
              Baja para desarmarla
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            </div>
          </>
        )}
      </div>
      {reduced && (
        <div className="story-list">
          {cards.slice(1).map((c, i) => (
            <div key={i} className="story-card on">
              {c}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
