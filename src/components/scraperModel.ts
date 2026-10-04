// Modelo procedural de la traílla de ruedas Cat 631G, con las proporciones de su ficha técnica y de fotos laterales:
// largo 14,57 m · ancho 3,94 m · alto a la cabina 3,71 m · distancia entre ejes 8,77 m · llantas 37.5R35 (≈ 2,4 m).
// Ejes: x hacia adelante, y hacia arriba, z hacia la derecha del operador. Unidades: metros.
// Eje delantero en x = 4,40 y trasero en x = -4,37. Las zonas inspeccionadas (Caja BW, Apron AP, Eyector EY)
// van en grupos propios para resaltarlas; las coordenadas de los puntos (catalog.ts POS3D) caen sobre su superficie.
import * as THREE from 'three';

export interface ScraperModel {
  root: THREE.Group;
  zones: Record<'BW' | 'AP' | 'EY', THREE.Group>;
  zonePaint: Record<'BW' | 'AP' | 'EY', THREE.MeshPhysicalMaterial>;
  dispose: () => void;
}

type V3 = [number, number, number];
type P2 = [number, number];

export const AXLE_FRONT = 4.4;
export const AXLE_REAR = -4.37;
const R = 1.2; // radio de llanta 37.5R35
const TW = 0.95; // ancho de llanta

export function buildScraper(): ScraperModel {
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  // ---------------------------------------------------------------- materiales
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => keep(new THREE.MeshPhysicalMaterial(p));
  const paintFor = () => phys({ color: 0xd59a12, roughness: 0.55, metalness: 0.1, clearcoat: 0.12, clearcoatRoughness: 0.5 });
  const paint = paintFor();
  const zonePaint = { BW: paintFor(), AP: paintFor(), EY: paintFor() };
  const frame = phys({ color: 0x22272b, roughness: 0.55, metalness: 0.45 });
  const steel = phys({ color: 0x5b6268, roughness: 0.4, metalness: 0.8 });
  const wear = phys({ color: 0x4a3f36, roughness: 0.75, metalness: 0.5 });
  const chrome = phys({ color: 0xe6e9ec, roughness: 0.08, metalness: 1 });
  const rubber = phys({ color: 0x18191b, roughness: 0.92, metalness: 0 });
  const glass = phys({ color: 0x15212a, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.82, envMapIntensity: 0.7 });
  const lamp = phys({ color: 0xfff6dc, emissive: 0xfff1c4, emissiveIntensity: 0.8, roughness: 0.2 });
  const amber = phys({ color: 0xf2a33a, emissive: 0xb86a10, emissiveIntensity: 0.5, roughness: 0.3 });
  const tail = phys({ color: 0xa3201b, emissive: 0x7a120e, emissiveIntensity: 0.6, roughness: 0.3 });
  const grille = phys({ color: 0x101214, roughness: 0.75, metalness: 0.3 });
  const hose = phys({ color: 0x1b1d1f, roughness: 0.7, metalness: 0.1 });

  const root = new THREE.Group();
  const zones = { BW: new THREE.Group(), AP: new THREE.Group(), EY: new THREE.Group() };
  Object.values(zones).forEach((g) => root.add(g));

  // ---------------------------------------------------------------- utilidades
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(keep(g), m);
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, p: V3, m: THREE.Material, parent?: THREE.Object3D, rot?: V3) => {
    const mesh = add(new THREE.BoxGeometry(w, h, d), m, parent);
    mesh.position.set(...p);
    if (rot) mesh.rotation.set(...rot);
    return mesh;
  };
  const roundRect = (w: number, h: number, r: number) => {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  /** Viga de sección cajón entre dos puntos (w = ancho horizontal, h = alto). */
  const beam = (a: V3, b: V3, w: number, h: number, m: THREE.Material, parent?: THREE.Object3D) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const g = new THREE.ExtrudeGeometry(roundRect(w, h, Math.min(w, h) * 0.18), { depth: va.distanceTo(vb), bevelEnabled: false, curveSegments: 3 });
    const mesh = add(g, m, parent);
    mesh.position.copy(va);
    mesh.up.set(0, 1, 0);
    if (Math.abs(vb.x - va.x) < 1e-6 && Math.abs(vb.z - va.z) < 1e-6) mesh.up.set(1, 0, 0);
    mesh.lookAt(vb);
    return mesh;
  };
  const rod = (a: V3, b: V3, r: number, m: THREE.Material, parent?: THREE.Object3D, seg = 18) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mesh = add(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), seg), m, parent);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return mesh;
  };
  const pin = (p: V3, r: number, len: number, m: THREE.Material, parent?: THREE.Object3D) => rod([p[0], p[1], p[2] - len / 2], [p[0], p[1], p[2] + len / 2], r, m, parent, 20);
  const hydraulic = (a: V3, b: V3, r: number, parent?: THREE.Object3D) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().lerp(vb, 0.55);
    rod(a, mid.toArray() as V3, r, frame, parent);
    rod(mid.toArray() as V3, b, r * 0.52, chrome, parent);
    const collar = rod(mid.clone().lerp(va, 0.04).toArray() as V3, mid.toArray() as V3, r * 1.12, steel, parent);
    collar.castShadow = true;
    for (const e of [va, vb]) {
      const eye = add(new THREE.SphereGeometry(r * 1.1, 14, 10), steel, parent);
      eye.position.copy(e);
    }
  };
  /** Perfil x-y extruido a lo ancho (z) desde z0. */
  const slab = (pts: P2[], depth: number, z0: number, m: THREE.Material, parent?: THREE.Object3D, bevel = 0.02, holes: P2[][] = []) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });
    const mesh = add(g, m, parent);
    mesh.position.z = z0;
    return mesh;
  };
  const arcPlate = (c: P2, r: number, t: number, a0: number, a1: number, depth: number, z0: number, m: THREE.Material, parent?: THREE.Object3D) => {
    const s = new THREE.Shape();
    s.absarc(c[0], c[1], r + t / 2, a0, a1, false);
    s.absarc(c[0], c[1], r - t / 2, a1, a0, true);
    const mesh = add(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 32 }), m, parent);
    mesh.position.z = z0;
    return mesh;
  };
  /** Perfil cajón extruido a lo largo de una curva. */
  const sweep = (pts: V3[], w: number, h: number, m: THREE.Material, parent?: THREE.Object3D) => {
    const path = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return add(new THREE.ExtrudeGeometry(roundRect(h, w, Math.min(w, h) * 0.2), { steps: 60, bevelEnabled: false, extrudePath: path }), m, parent);
  };

  // ---------------------------------------------------------------- llantas 37.5R35 con rin y tacos
  const lugGeo = keep(new THREE.BoxGeometry(0.075, 0.2, 1));
  const boltGeo = keep(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8));
  const m4 = new THREE.Matrix4();
  const wheel = (x: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, R, z);
    root.add(g);
    const ri = 0.5;
    const hw = TW / 2;
    const sh = 0.2;
    const prof: THREE.Vector2[] = [new THREE.Vector2(ri, -hw * 0.86)];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2);
      prof.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh));
    }
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      prof.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh));
    }
    prof.push(new THREE.Vector2(ri, hw * 0.86));
    const tire = add(new THREE.LatheGeometry(prof, 72), rubber, g);
    tire.rotation.x = Math.PI / 2;
    // Tacos en V
    const n = 34;
    const lugs = new THREE.InstancedMesh(lugGeo, rubber, n * 2);
    for (let i = 0; i < n; i++)
      for (const side of [-1, 1]) {
        const a = (i / n) * Math.PI * 2 + (side > 0 ? Math.PI / n : 0);
        m4.compose(
          new THREE.Vector3(Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02), side * TW * 0.23),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.42, a)),
          new THREE.Vector3(1, 1, TW * 0.44),
        );
        lugs.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4);
      }
    g.add(lugs);
    // Rin
    const out = Math.sign(z) || 1;
    const rim = add(new THREE.CylinderGeometry(ri, ri, TW * 0.82, 40, 1, true), paint, g);
    rim.rotation.x = Math.PI / 2;
    const flange = add(new THREE.TorusGeometry(ri, 0.035, 8, 40), paint, g);
    flange.position.z = out * TW * 0.41;
    const disc = add(new THREE.CylinderGeometry(ri * 0.97, ri * 0.97, 0.04, 40), paint, g);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = out * TW * 0.12;
    const hub = add(new THREE.CylinderGeometry(ri * 0.46, ri * 0.52, 0.32, 28), paint, g);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = out * TW * 0.25;
    const cap = add(new THREE.CylinderGeometry(ri * 0.22, ri * 0.26, 0.1, 20), steel, g);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = out * (TW * 0.25 + 0.2);
    const bolts = new THREE.InstancedMesh(boltGeo, steel, 18);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      m4.compose(
        new THREE.Vector3(Math.cos(a) * ri * 0.7, Math.sin(a) * ri * 0.7, out * TW * 0.14),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      bolts.setMatrixAt(i, m4);
    }
    g.add(bolts);
  };

  // ================================================================ TRACTOR
  const XF = AXLE_FRONT;
  wheel(XF, 1.61);
  wheel(XF, -1.61);
  rod([XF, R, -1.2], [XF, R, 1.2], 0.24, frame);
  box(0.9, 0.5, 1.0, [XF, R, 0], frame);

  // Bastidor del tractor
  beam([2.85, 1.05, 0], [7.7, 1.05, 0], 1.15, 0.5, frame);
  // Defensa delantera con peldaños
  box(0.24, 0.5, 2.35, [7.78, 1.0, 0], frame);
  box(0.06, 0.12, 2.2, [7.92, 1.18, 0], steel);
  for (const s of [1, -1]) {
    for (let i = 0; i < 2; i++) box(0.2, 0.04, 0.4, [7.88, 0.5 + i * 0.3, 0.88 * s], steel);
    rod([7.8, 0.45, 0.68 * s], [7.8, 0.78, 0.68 * s], 0.02, frame);
    rod([7.8, 0.45, 1.08 * s], [7.8, 0.78, 1.08 * s], 0.02, frame);
  }

  // Módulo del motor bajo la cabina y caja del radiador al frente
  box(1.8, 0.65, 2.0, [5.85, 1.62, 0], paint);
  for (const s of [1, -1]) for (let i = 0; i < 7; i++) box(0.09, 0.42, 0.02, [5.25 + i * 0.2, 1.62, 1.01 * s], grille);
  slab(
    [
      [6.72, 1.25],
      [7.66, 1.25],
      [7.66, 2.62],
      [7.55, 2.78],
      [6.72, 2.82],
    ],
    1.96,
    -0.98,
    paint,
    undefined,
    0.04,
  );
  box(0.05, 1.05, 1.5, [7.69, 1.95, 0], grille);
  for (let i = 0; i < 12; i++) box(0.04, 0.03, 1.5, [7.72, 1.5 + i * 0.085, 0], steel);
  box(0.06, 0.22, 1.7, [7.69, 2.62, 0], paint);
  for (const s of [1, -1]) {
    const hl = add(new THREE.BoxGeometry(0.08, 0.14, 0.24), lamp);
    hl.position.set(7.69, 2.62, 0.62 * s);
    box(0.06, 0.06, 0.12, [7.7, 2.4, 0.9 * s], amber);
    // Rejillas laterales del radiador
    for (let i = 0; i < 5; i++) box(0.5, 0.05, 0.02, [7.15, 1.75 + i * 0.12, 0.99 * s], grille);
  }
  // Prefiltro y escape sobre el radiador
  rod([7.25, 2.8, 0.55], [7.25, 3.15, 0.55], 0.16, frame);
  rod([7.25, 3.15, 0.55], [7.25, 3.22, 0.55], 0.19, steel);
  rod([6.95, 2.8, -0.62], [6.95, 3.75, -0.62], 0.085, frame);
  rod([6.95, 3.75, -0.62], [7.0, 3.88, -0.62], 0.085, frame);
  // Pasamanos del techo del radiador
  for (const s of [1, -1]) {
    rod([6.78, 3.0, 0.9 * s], [7.55, 3.0, 0.9 * s], 0.022, frame);
    for (const x of [6.8, 7.5]) rod([x, 2.8, 0.9 * s], [x, 3.0, 0.9 * s], 0.022, frame);
  }

  // Cabina ROPS
  const cab = new THREE.Group();
  cab.position.set(5.85, 1.95, 0);
  root.add(cab);
  const CW = 1.8;
  const CL = 1.72;
  box(CL, 0.7, CW, [0, 0.35, 0], paint, cab);
  box(CL - 0.06, 1.18, CW - 0.06, [0, 1.29, 0], glass, cab);
  for (const [px, pz] of [
    [-CL / 2, -CW / 2],
    [-CL / 2, CW / 2],
    [CL / 2, -CW / 2],
    [CL / 2, CW / 2],
  ])
    box(0.1, 1.22, 0.1, [px, 1.3, pz], paint, cab);
  // Parales intermedios y puerta del lado izquierdo
  for (const s of [1, -1]) box(0.06, 1.18, 0.05, [-0.05, 1.29, (CW / 2) * s], paint, cab);
  box(CL, 0.07, 0.07, [0, 0.72, CW / 2], paint, cab);
  box(CL, 0.07, 0.07, [0, 0.72, -CW / 2], paint, cab);
  box(0.06, 0.06, CW, [CL / 2, 0.72, 0], paint, cab);
  rod([0.35, 0.95, -CW / 2 - 0.05], [0.35, 1.45, -CW / 2 - 0.05], 0.02, frame, cab);
  // Techo con alero
  slab(
    [
      [-CL / 2 - 0.08, 0],
      [CL / 2 + 0.14, 0],
      [CL / 2 + 0.08, 0.16],
      [-CL / 2 - 0.04, 0.16],
    ],
    CW + 0.16,
    -CW / 2 - 0.08,
    paint,
    cab,
    0.02,
  ).position.y = 1.9;
  box(0.4, 0.1, 0.5, [-0.3, 2.12, 0], frame, cab);
  const beacon = add(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 14), amber, cab);
  beacon.position.set(-0.6, 2.13, 0.6);
  for (const s of [1, -1]) {
    const l = add(new THREE.BoxGeometry(0.08, 0.1, 0.18), lamp, cab);
    l.position.set(CL / 2 + 0.12, 1.98, 0.6 * s);
    rod([CL / 2, 1.55, (CW / 2) * s], [CL / 2 + 0.25, 1.7, (CW / 2 + 0.3) * s], 0.015, frame, cab);
    box(0.04, 0.3, 0.18, [CL / 2 + 0.27, 1.7, (CW / 2 + 0.33) * s], frame, cab);
  }
  // Escalera de acceso y plataforma lateral (lado izquierdo)
  box(1.9, 0.07, 0.4, [5.85, 1.92, -1.18], steel);
  for (let i = 0; i < 4; i++) box(0.32, 0.04, 0.3, [6.75, 0.45 + i * 0.37, -1.2], steel);
  rod([6.6, 0.4, -1.2], [6.6, 1.95, -1.2], 0.022, frame);
  rod([6.9, 0.4, -1.2], [6.9, 1.95, -1.2], 0.022, frame);
  rod([4.95, 1.95, -1.36], [6.8, 1.95, -1.36], 0.02, frame);
  rod([4.95, 1.95, -1.36], [4.95, 2.85, -1.36], 0.022, frame);
  rod([6.8, 1.95, -1.36], [6.8, 2.6, -1.36], 0.022, frame);
  rod([4.95, 2.85, -1.36], [6.8, 2.6, -1.36], 0.022, frame);

  // Guardabarros delanteros de techo plano
  for (const s of [1, -1]) {
    slab(
      [
        [XF - 1.45, 1.75],
        [XF - 1.2, 2.5],
        [XF + 0.9, 2.5],
        [XF + 1.4, 2.1],
        [XF + 1.4, 1.95],
        [XF + 0.85, 2.38],
        [XF - 1.14, 2.38],
        [XF - 1.36, 1.75],
      ],
      TW + 0.15,
      s > 0 ? 1.61 - (TW + 0.15) / 2 : -1.61 - (TW + 0.15) / 2,
      paint,
      undefined,
      0.015,
    );
  }

  // Tanque hidráulico y tuberías detrás de la cabina
  box(1.1, 1.0, 1.4, [4.35, 2.2, 0], paint);
  rod([4.6, 2.75, 0.4], [4.6, 2.95, 0.4], 0.1, steel);
  for (const [z, y] of [
    [-0.35, 2.75],
    [-0.15, 2.85],
    [0.1, 2.8],
  ])
    sweep(
      [
        [4.2, y, z],
        [3.6, y + 0.35, z],
        [2.95, 3.45, z * 0.6],
        [2.2, 3.72, z * 0.6],
      ],
      0.07,
      0.07,
      hose,
    );

  // Enganche (rótula) y cuello de cisne en arco
  rod([2.95, 0.7, 0], [2.95, 1.6, 0], 0.32, frame);
  rod([2.95, 0.95, 0], [2.95, 1.12, 0], 0.4, steel);
  box(0.7, 0.4, 1.0, [3.3, 1.0, 0], frame);
  // Cuello de cisne: cajón alto y angosto que sube detrás de la cabina y baja en arco hasta el yugo.
  sweep(
    [
      [2.95, 1.45, 0],
      [3.0, 2.5, 0],
      [2.9, 3.25, 0],
      [2.5, 3.66, 0],
      [1.95, 3.62, 0],
      [1.5, 3.25, 0],
      [1.22, 2.7, 0],
    ],
    0.62,
    0.5,
    paint,
  );
  // Placas laterales de refuerzo del cuello
  for (const s of [1, -1]) slab([[2.7, 1.5], [3.25, 1.5], [3.25, 2.6], [2.7, 2.9]], 0.04, s > 0 ? 0.31 : -0.35, paint);

  // Yugo del bastidor de tiro y brazos a los muñones de la caja
  pin([1.05, 2.5, 0], 0.3, 4.1, paint);
  for (const s of [1, -1]) {
    pin([1.05, 2.5, 2.05 * s], 0.33, 0.12, steel);
    beam([1.05, 2.45, 1.95 * s], [-1.95, 1.3, 1.98 * s], 0.32, 0.55, paint);
    // Muñón en el lateral de la caja
    pin([-1.95, 1.3, 1.92 * s], 0.22, 0.32, frame);
    pin([-1.95, 1.3, 2.1 * s], 0.12, 0.08, steel);
    // Cilindros de levante de la caja: del yugo a la esquina superior delantera
    hydraulic([1.55, 3.25, 0.5 * s], [0.75, 2.3, 1.62 * s], 0.11);
  }

  // ================================================================ CAJA (BW)
  const bw = zones.BW;
  const X0 = -3.15; // trasera de la caja, justo delante de la llanta trasera
  const XC = 0.55; // cuchilla
  const side: P2[] = [
    [X0, 0.95],
    [X0 + 0.35, 0.62],
    [XC, 0.4],
    [0.98, 1.35],
    [0.98, 2.25],
    [X0, 2.62],
  ];
  // Ventanas de aligeramiento inferiores (como en la foto lateral)
  const cut = (x: number): P2[] => [
    [x, 0.72],
    [x + 0.42, 0.7],
    [x + 0.42, 0.98],
    [x, 1.0],
  ];
  for (const s of [1, -1]) {
    const z0 = s > 0 ? 1.76 : -1.84;
    slab(side, 0.08, z0, zonePaint.BW, bw, 0.012);
    // Placas de desgaste inferiores
    for (const x of [-2.6, -1.85, -1.1, -0.35]) slab(cut(x), 0.03, s > 0 ? 1.85 : -1.88, wear, bw, 0);
    // Riel superior, cinturón y nervios verticales
    beam([X0 - 0.02, 2.66, 1.82 * s], [1.0, 2.29, 1.82 * s], 0.22, 0.2, zonePaint.BW, bw);
    beam([X0 + 0.1, 1.62, 1.88 * s], [0.75, 1.55, 1.88 * s], 0.07, 0.16, zonePaint.BW, bw);
    for (const x of [-2.7, -1.3, -0.3]) beam([x, 0.78, 1.88 * s], [x, 2.48 + (x - X0) * -0.09, 1.88 * s], 0.06, 0.12, zonePaint.BW, bw);
  }
  // Piso, cuchilla y puntas
  const floor = box(XC - X0 - 0.3, 0.06, 3.52, [(XC + X0 + 0.3) / 2, 0.52, 0], zonePaint.BW, bw);
  floor.rotation.z = -0.055;
  box(0.32, 0.07, 3.64, [XC + 0.06, 0.37, 0], steel, bw);
  for (const z of [-1.55, 1.55]) box(0.3, 0.08, 0.5, [XC + 0.16, 0.36, z], steel, bw);
  // Travesaño superior trasero
  pin([-0.6, 2.42, 0], 0.12, 3.52, zonePaint.BW, bw);
  for (const s of [1, -1]) box(0.32, 0.32, 0.1, [-0.6, 2.42, 1.71 * s], zonePaint.BW, bw);
  // Frente de la caja sobre la cuchilla
  box(0.12, 0.35, 3.52, [0.86, 2.2, 0], zonePaint.BW, bw);

  // ================================================================ APRON (AP)
  const ap = zones.AP;
  const AC: P2 = [-0.15, 1.15];
  const AR = 1.35;
  arcPlate(AC, AR, 0.07, -0.48, 0.56, 3.5, -1.75, zonePaint.AP, ap);
  for (const z of [-1.15, -0.4, 0.4, 1.15]) arcPlate(AC, AR + 0.05, 0.05, -0.42, 0.5, 0.08, z - 0.04, zonePaint.AP, ap);
  // Labio de acero
  box(0.1, 0.1, 3.5, [AC[0] + AR * Math.cos(-0.48) - 0.02, AC[1] + AR * Math.sin(-0.48), 0], steel, ap);
  // Placas laterales y brazos al pivote en el costado de la caja
  const apSide: P2[] = [
    [-0.5, 1.75],
    [AC[0] + AR * Math.cos(0.56), AC[1] + AR * Math.sin(0.56)],
    [AC[0] + AR, AC[1]],
    [AC[0] + AR * Math.cos(-0.48), AC[1] + AR * Math.sin(-0.48)],
    [0.35, 0.75],
  ];
  for (const s of [1, -1]) {
    slab(apSide, 0.06, s > 0 ? 1.72 : -1.78, zonePaint.AP, ap, 0.01);
    beam([0.95, 1.9, 1.95 * s], [-0.5, 1.75, 1.95 * s], 0.08, 0.2, zonePaint.AP, ap);
    pin([-0.5, 1.75, 1.92 * s], 0.13, 0.16, frame, ap);
    pin([-0.5, 1.75, 2.02 * s], 0.08, 0.06, steel, ap);
  }
  // Oreja de levante central y cilindro del apron (al yugo)
  box(0.3, 0.32, 0.14, [0.98, 1.92, 0], zonePaint.AP, ap);
  pin([1.02, 1.98, 0], 0.06, 0.26, steel, ap);
  hydraulic([1.35, 2.62, 0], [1.05, 2.0, 0], 0.08, ap);

  // ================================================================ EYECTOR (EY)
  const ey = zones.EY;
  box(0.1, 1.85, 3.36, [-2.32, 1.55, 0], zonePaint.EY, ey);
  for (const y of [0.85, 1.55, 2.25]) box(0.14, 0.1, 3.3, [-2.43, y, 0], zonePaint.EY, ey);
  for (const s of [1, -1]) beam([-2.4, 1.0, 0.85 * s], [-4.1, 0.95, 0.85 * s], 0.18, 0.24, zonePaint.EY, ey);
  box(0.3, 0.45, 0.45, [-2.5, 1.6, 0], zonePaint.EY, ey);
  hydraulic([-2.65, 1.6, 0], [-5.4, 1.45, 0], 0.12, ey);

  // ================================================================ PARTE TRASERA
  const XR = AXLE_REAR;
  wheel(XR, 1.35);
  wheel(XR, -1.35);
  rod([XR, R, -0.85], [XR, R, 0.85], 0.26, frame);
  // Pared trasera de la caja que se estrecha hacia el bastidor
  slab(
    [
      [X0, 0.95],
      [X0, 2.62],
      [X0 - 0.25, 2.55],
      [X0 - 0.25, 1.0],
    ],
    3.6,
    -1.8,
    paint,
  );
  // Bastidor trasero entre las llantas
  beam([X0 - 0.2, 1.55, 0], [-6.45, 1.35, 0], 1.3, 0.75, paint);
  // Cubierta trasera con faros sobre las llantas
  box(1.0, 0.16, 3.9, [-5.35, 2.18, 0], paint);
  box(0.12, 0.3, 3.9, [-5.85, 2.05, 0], paint);
  for (const s of [1, -1]) {
    box(0.06, 0.14, 0.28, [-5.92, 2.08, 1.65 * s], tail);
    box(0.06, 0.12, 0.14, [-5.92, 2.08, 1.4 * s], amber);
    // Patas de la cubierta
    beam([-5.0, 1.6, 0.6 * s], [-5.1, 2.12, 0.6 * s], 0.12, 0.12, paint);
    beam([-5.75, 1.45, 0.6 * s], [-5.75, 2.0, 0.6 * s], 0.12, 0.12, paint);
  }
  // Barandilla y escalera trasera (lado derecho)
  rod([-5.5, 2.26, 0.45], [-5.5, 3.1, 0.45], 0.025, frame);
  rod([-4.9, 2.26, 0.45], [-4.9, 3.1, 0.45], 0.025, frame);
  rod([-5.5, 3.1, 0.45], [-4.9, 3.1, 0.45], 0.025, frame);
  // Bloque de empuje
  slab(
    [
      [-6.35, 0.55],
      [-6.72, 0.62],
      [-6.78, 0.95],
      [-6.72, 1.38],
      [-6.35, 1.45],
    ],
    1.7,
    -0.85,
    wear,
    undefined,
    0.03,
  );
  box(0.08, 0.12, 1.8, [-6.8, 0.98, 0], steel);

  // Sombras y aristas finas, como en un modelo CAD.
  const edgeMat = keep(new THREE.LineBasicMaterial({ color: 0x2a2110, transparent: true, opacity: 0.28 }));
  const outlined = new Set<THREE.Material>([paint, frame, steel, wear, ...Object.values(zonePaint)]);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      if (!(m as unknown as THREE.InstancedMesh).isInstancedMesh && outlined.has(m.material as THREE.Material)) meshes.push(m);
    }
  });
  for (const m of meshes) {
    const lines = new THREE.LineSegments(keep(new THREE.EdgesGeometry(m.geometry, 32)), edgeMat);
    lines.userData.edge = true;
    m.add(lines);
  }

  return { root, zones, zonePaint, dispose: () => disposables.forEach((d) => d.dispose()) };
}
