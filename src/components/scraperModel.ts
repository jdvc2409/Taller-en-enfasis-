// Geometría procedural de una traílla de ruedas de un motor, tipo 631G.
// Ejes: x hacia adelante (tractor delante), y hacia arriba, z hacia la derecha del operador. Unidades ≈ m.
// Las zonas inspeccionadas (Caja BW, Apron AP, Eyector EY) van en grupos propios para poder resaltarlas
// y para que las coordenadas de los puntos (catalog.ts POS3D) queden sobre la superficie.
import * as THREE from 'three';

export interface ScraperModel {
  root: THREE.Group;
  zones: Record<'BW' | 'AP' | 'EY', THREE.Group>;
  dispose: () => void;
}

type V3 = [number, number, number];

export function buildScraper(): ScraperModel {
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  // ---------------------------------------------------------------- materiales
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => keep(new THREE.MeshPhysicalMaterial(p));
  const paintFor = () => phys({ color: 0xd39614, roughness: 0.5, metalness: 0.1, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const paint = paintFor();
  const zonePaint = { BW: paintFor(), AP: paintFor(), EY: paintFor() };
  const frame = phys({ color: 0x24292e, roughness: 0.55, metalness: 0.45 });
  const steel = phys({ color: 0x5d656c, roughness: 0.38, metalness: 0.8 });
  const chrome = phys({ color: 0xe4e8eb, roughness: 0.08, metalness: 1 });
  const rubber = phys({ color: 0x17191b, roughness: 0.93, metalness: 0 });
  const glass = phys({ color: 0x16222a, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.78, envMapIntensity: 0.6 });
  const lamp = phys({ color: 0xfff6dc, emissive: 0xfff1c4, emissiveIntensity: 0.9, roughness: 0.2 });
  const tail = phys({ color: 0xa3201b, emissive: 0x7a120e, emissiveIntensity: 0.6, roughness: 0.3 });
  const grille = phys({ color: 0x111315, roughness: 0.7, metalness: 0.3 });

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
  /** Perfil rectangular redondeado (para perfiles de acero). */
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
  /** Viga de sección cajón entre dos puntos. */
  const beam = (a: V3, b: V3, w: number, h: number, m: THREE.Material, parent?: THREE.Object3D) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const g = new THREE.ExtrudeGeometry(roundRect(w, h, Math.min(w, h) * 0.18), { depth: len, bevelEnabled: false, curveSegments: 3 });
    const mesh = add(g, m, parent);
    mesh.position.copy(va);
    mesh.lookAt(vb);
    return mesh;
  };
  /** Cilindro entre dos puntos. */
  const rod = (a: V3, b: V3, r: number, m: THREE.Material, parent?: THREE.Object3D, seg = 18) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mesh = add(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), seg), m, parent);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return mesh;
  };
  /** Cilindro hidráulico: camisa de acero y vástago cromado. */
  const hydraulic = (a: V3, b: V3, r: number, parent?: THREE.Object3D) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().lerp(vb, 0.56);
    rod(a, mid.toArray() as V3, r, frame, parent);
    rod(mid.toArray() as V3, b, r * 0.55, chrome, parent);
    for (const e of [va, vb]) {
      const eye = add(new THREE.SphereGeometry(r * 1.15, 14, 10), steel, parent);
      eye.position.copy(e);
    }
  };
  /** Perfil en el plano x-y extruido a lo ancho (z), desde z0. */
  const slab = (pts: [number, number][], depth: number, z0: number, m: THREE.Material, parent?: THREE.Object3D, bevel = 0.02) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12 });
    const mesh = add(g, m, parent);
    mesh.position.z = z0;
    return mesh;
  };
  /** Lámina curva: sector de anillo en el plano x-y, extruido en z. Ángulos en radianes desde +x. */
  const arcPlate = (c: [number, number], r: number, t: number, a0: number, a1: number, depth: number, z0: number, m: THREE.Material, parent?: THREE.Object3D) => {
    const s = new THREE.Shape();
    s.absarc(c[0], c[1], r + t / 2, a0, a1, false);
    s.absarc(c[0], c[1], r - t / 2, a1, a0, true);
    const mesh = add(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 28 }), m, parent);
    mesh.position.z = z0;
    return mesh;
  };

  // ---------------------------------------------------------------- llantas
  const lugGeo = keep(new THREE.BoxGeometry(0.07, 0.15, 1));
  const boltGeo = keep(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 8));
  const wheel = (x: number, z: number, r: number, w: number) => {
    const g = new THREE.Group();
    g.position.set(x, r, z);
    root.add(g);
    // Sección de la llanta: rectángulo con hombros redondeados, girado alrededor del eje.
    const prof: THREE.Vector2[] = [];
    const ri = r * 0.6;
    const hw = w / 2;
    const sh = 0.16;
    prof.push(new THREE.Vector2(ri, -hw * 0.92));
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
      prof.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh));
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      prof.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh));
    }
    prof.push(new THREE.Vector2(ri, hw * 0.92));
    const tire = add(new THREE.LatheGeometry(prof, 64), rubber, g);
    tire.rotation.x = Math.PI / 2;
    // Tacos en V de la banda de rodadura.
    const n = 30;
    const lugs = new THREE.InstancedMesh(lugGeo, rubber, n * 2);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      for (const side of [-1, 1]) {
        const a = (i / n) * Math.PI * 2 + (side > 0 ? Math.PI / n : 0);
        const p = new THREE.Vector3(Math.cos(a) * (r + 0.02), Math.sin(a) * (r + 0.02), side * w * 0.22);
        q.setFromEuler(new THREE.Euler(0, side * 0.5, a));
        m4.compose(p, q, new THREE.Vector3(1, 1, w * 0.42));
        lugs.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4);
      }
    }
    g.add(lugs);
    // Rin pintado con disco, maza y pernos.
    const out = Math.sign(z) || 1;
    const rim = add(new THREE.CylinderGeometry(ri, ri, w * 0.86, 40, 1, true), paint, g);
    rim.rotation.x = Math.PI / 2;
    const disc = add(new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, 0.04, 40), paint, g);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = out * w * 0.18;
    const hub = add(new THREE.CylinderGeometry(ri * 0.42, ri * 0.48, 0.22, 28), frame, g);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = out * w * 0.27;
    const cap = add(new THREE.SphereGeometry(ri * 0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel, g);
    cap.rotation.x = (out * Math.PI) / 2;
    cap.position.z = out * w * 0.38;
    const bolts = new THREE.InstancedMesh(boltGeo, steel, 16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      m4.compose(
        new THREE.Vector3(Math.cos(a) * ri * 0.55, Math.sin(a) * ri * 0.55, out * w * 0.2),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      bolts.setMatrixAt(i, m4);
    }
    g.add(bolts);
    return g;
  };

  const fender = (x: number, z: number, r: number, w: number, a0: number, a1: number) => {
    arcPlate([x, r], r + 0.16, 0.05, a0, a1, w, z - w / 2, paint);
  };

  // ---------------------------------------------------------------- tractor delantero
  const R = 1.05;
  wheel(5.7, 1.62, R, 0.86);
  wheel(5.7, -1.62, R, 0.86);
  fender(5.7, 1.62, R, 0.98, 0.15, Math.PI - 0.55);
  fender(5.7, -1.62, R, 0.98, 0.15, Math.PI - 0.55);
  rod([5.7, R, -1.3], [5.7, R, 1.3], 0.2, frame);

  // Bastidor y defensa
  beam([3.4, 1.18, 0], [8.0, 1.18, 0], 0.95, 0.42, frame);
  box(0.42, 0.62, 2.05, [8.18, 1.3, 0], frame);
  box(0.1, 0.36, 1.9, [8.42, 1.36, 0], steel);
  for (const s of [1, -1]) {
    const h = add(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 18), lamp);
    h.rotation.z = Math.PI / 2;
    h.position.set(8.43, 1.52, 0.72 * s);
  }

  // Capó del motor (perfil lateral extruido)
  slab(
    [
      [4.95, 1.42],
      [7.8, 1.42],
      [7.98, 1.62],
      [7.98, 2.32],
      [7.82, 2.52],
      [6.1, 2.62],
      [4.95, 2.66],
    ],
    1.44,
    -0.72,
    paint,
    undefined,
    0.05,
  );
  // Rejilla del radiador
  box(0.06, 0.66, 1.18, [8.02, 1.98, 0], grille);
  for (let i = 0; i < 9; i++) box(0.05, 0.025, 1.18, [8.06, 1.7 + i * 0.07, 0], steel);
  // Rejillas laterales del capó
  for (const s of [1, -1]) for (let i = 0; i < 6; i++) box(0.05, 0.42, 0.02, [6.5 + i * 0.13, 2.0, 0.79 * s], grille);
  // Escape y prefiltro
  rod([7.0, 2.6, -0.42], [7.0, 3.45, -0.42], 0.075, frame);
  rod([7.0, 3.45, -0.42], [7.07, 3.6, -0.42], 0.075, frame);
  rod([6.55, 2.62, 0.42], [6.55, 3.0, 0.42], 0.15, frame);
  rod([6.55, 3.0, 0.42], [6.55, 3.06, 0.42], 0.17, steel);
  // Pasamanos sobre el capó
  for (const s of [1, -1]) {
    rod([5.1, 2.7, 0.66 * s], [7.6, 2.7, 0.66 * s], 0.025, frame);
    for (const x of [5.2, 6.4, 7.5]) rod([x, 2.62, 0.66 * s], [x, 2.72, 0.66 * s], 0.022, frame);
  }

  // Plataforma, escalera y cabina
  box(1.95, 0.1, 2.3, [4.45, 1.58, 0], steel);
  for (let i = 0; i < 3; i++) box(0.5, 0.04, 0.22, [3.9, 0.5 + i * 0.36, 1.25], steel);
  rod([3.65, 0.4, 1.25], [3.65, 1.6, 1.25], 0.025, frame);
  rod([4.15, 0.4, 1.25], [4.15, 1.6, 1.25], 0.025, frame);
  for (const s of [1, -1]) {
    rod([3.5, 1.63, 1.12 * s], [5.4, 1.63, 1.12 * s], 0.02, frame);
    rod([3.5, 1.63, 1.12 * s], [3.5, 2.55, 1.12 * s], 0.025, frame);
    rod([3.5, 2.55, 1.12 * s], [3.75, 2.55, 1.12 * s], 0.025, frame);
  }
  const cab = new THREE.Group();
  cab.position.set(4.5, 1.63, 0);
  root.add(cab);
  // Parte baja de la cabina pintada y vidrios arriba, con postes.
  box(1.5, 0.62, 1.5, [0, 0.31, 0], paint, cab);
  box(1.46, 1.32, 1.46, [0, 1.28, 0], glass, cab);
  for (const [px, pz] of [
    [-0.73, -0.73],
    [-0.73, 0.73],
    [0.73, -0.73],
    [0.73, 0.73],
  ])
    box(0.08, 1.36, 0.08, [px, 1.28, pz], paint, cab);
  box(0.06, 0.06, 1.5, [0.73, 0.62, 0], paint, cab);
  box(0.06, 0.06, 1.5, [-0.73, 0.62, 0], paint, cab);
  slab(
    [
      [-0.86, 0],
      [0.92, 0],
      [0.86, 0.14],
      [-0.82, 0.14],
    ],
    1.66,
    -0.83,
    paint,
    cab,
    0.02,
  ).position.y = 1.96;
  box(0.3, 0.08, 0.5, [0, 2.15, 0], frame, cab);
  for (const s of [1, -1]) {
    rod([0.75, 1.6, 0.76 * s], [0.95, 1.7, 1.05 * s], 0.015, frame, cab);
    box(0.04, 0.24, 0.15, [0.97, 1.7, 1.08 * s], frame, cab);
    const l = add(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 14), lamp, cab);
    l.rotation.z = Math.PI / 2;
    l.position.set(0.9, 2.02, 0.6 * s);
  }

  // Rótula de enganche
  rod([3.55, 0.75, 0], [3.55, 2.05, 0], 0.27, frame);
  rod([3.55, 0.9, 0], [3.55, 1.05, 0], 0.33, steel);
  box(0.6, 0.3, 0.9, [3.85, 1.0, 0], frame);

  // ---------------------------------------------------------------- cuello de cisne y brazos de tiro
  const neckPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.55, 1.95, 0),
    new THREE.Vector3(3.5, 2.85, 0),
    new THREE.Vector3(3.15, 3.28, 0),
    new THREE.Vector3(2.4, 3.42, 0),
    new THREE.Vector3(1.6, 3.32, 0),
  ]);
  add(new THREE.ExtrudeGeometry(roundRect(0.62, 0.46, 0.1), { steps: 40, bevelEnabled: false, extrudePath: neckPath }), paint);
  beam([1.62, 3.25, -0.62], [1.62, 3.25, 0.62], 0.36, 0.34, paint);
  for (const s of [1, -1]) {
    beam([1.62, 3.22, 0.5 * s], [0.38, 2.78, 2.0 * s], 0.24, 0.3, paint);
    beam([0.38, 2.78, 2.0 * s], [-1.62, 1.48, 2.0 * s], 0.24, 0.3, paint);
    const t = rod([-1.62, 1.48, 1.86 * s], [-1.62, 1.48, 2.16 * s], 0.18, frame);
    t.castShadow = true;
    // Cilindros de levante de la caja
    hydraulic([2.35, 3.22, 0.58 * s], [0.62, 2.05, 1.92 * s], 0.09);
  }

  // ---------------------------------------------------------------- caja (BW)
  const bw = zones.BW;
  const sideProfile: [number, number][] = [
    [-6.0, 0.98],
    [-5.72, 0.56],
    [-0.6, 0.42],
    [0.36, 0.3],
    [0.36, 2.3],
    [0.15, 3.0],
    [-6.0, 3.0],
  ];
  slab(sideProfile, 0.08, 1.74, zonePaint.BW, bw, 0.015);
  slab(sideProfile, 0.08, -1.82, zonePaint.BW, bw, 0.015);
  for (const s of [1, -1]) {
    beam([-6.05, 3.06, 1.8 * s], [0.2, 3.06, 1.8 * s], 0.24, 0.2, zonePaint.BW, bw);
    beam([-5.9, 1.42, 1.86 * s], [0.25, 1.32, 1.86 * s], 0.08, 0.14, zonePaint.BW, bw);
    for (const x of [-1.0, -2.2, -3.4, -4.6]) box(0.14, 2.42, 0.06, [x, 1.8, 1.87 * s], zonePaint.BW, bw);
  }
  const floor = box(6.15, 0.06, 3.5, [-2.7, 0.46, 0], zonePaint.BW, bw);
  floor.rotation.z = -0.038;
  box(0.28, 0.08, 3.66, [0.46, 0.27, 0], steel, bw);
  for (const z of [-1.2, 0, 1.2]) box(0.2, 0.06, 0.9, [0.62, 0.25, z], steel, bw);
  rod([-1.4, 2.96, -1.78], [-1.4, 2.96, 1.78], 0.13, zonePaint.BW, bw);
  for (const s of [1, -1]) box(0.3, 0.3, 0.12, [-1.4, 2.96, 1.68 * s], zonePaint.BW, bw);

  // ---------------------------------------------------------------- apron (AP)
  const ap = zones.AP;
  // Lámina curva de la compuerta, de la oreja superior al labio inferior.
  arcPlate([0.35, 1.95], 1.55, 0.07, -0.72, 0.6, 3.5, -1.75, zonePaint.AP, ap);
  // Nervios de refuerzo de la cara frontal
  for (const z of [-1.1, -0.35, 0.35, 1.1]) arcPlate([0.35, 1.95], 1.6, 0.06, -0.62, 0.55, 0.08, z - 0.04, zonePaint.AP, ap);
  // Placas laterales y pivotes
  const apSide: [number, number][] = [
    [0.2, 2.62],
    [1.65, 2.82],
    [1.88, 2.25],
    [1.9, 1.6],
    [1.55, 0.95],
    [1.08, 0.64],
    [0.42, 0.9],
  ];
  slab(apSide, 0.06, 1.76, zonePaint.AP, ap, 0.01);
  slab(apSide, 0.06, -1.82, zonePaint.AP, ap, 0.01);
  for (const s of [1, -1]) {
    const piv = rod([0.2, 2.45, 1.78 * s], [0.2, 2.45, 2.0 * s], 0.16, frame, ap);
    piv.castShadow = true;
    rod([0.2, 2.45, 1.97 * s], [0.2, 2.45, 2.03 * s], 0.2, steel, ap);
    beam([1.55, 2.7, 1.79 * s], [0.25, 2.5, 1.79 * s], 0.06, 0.14, zonePaint.AP, ap);
  }
  // Labio inferior de acero
  box(0.12, 0.1, 3.5, [1.08, 0.66, 0], steel, ap);
  // Oreja de levante y cilindro del apron
  box(0.36, 0.42, 0.16, [1.92, 2.88, 0], zonePaint.AP, ap);
  rod([1.92, 2.98, -0.12], [1.92, 2.98, 0.12], 0.07, steel, ap);
  hydraulic([2.82, 3.36, 0], [1.98, 2.98, 0], 0.075, ap);

  // ---------------------------------------------------------------- eyector (EY)
  const ey = zones.EY;
  box(0.1, 2.24, 3.36, [-4.45, 1.72, 0], zonePaint.EY, ey);
  for (const y of [0.95, 1.7, 2.45]) box(0.14, 0.1, 3.3, [-4.56, y, 0], zonePaint.EY, ey);
  for (const s of [1, -1]) beam([-4.5, 1.25, 0.9 * s], [-6.75, 1.12, 0.9 * s], 0.18, 0.22, zonePaint.EY, ey);
  beam([-6.75, 1.12, -1.0], [-6.75, 1.12, 1.0], 0.2, 0.24, zonePaint.EY, ey);
  box(0.28, 0.42, 0.42, [-4.62, 1.65, 0], zonePaint.EY, ey);
  hydraulic([-4.75, 1.65, 0], [-6.95, 1.42, 0], 0.11, ey);

  // ---------------------------------------------------------------- parte trasera
  wheel(-5.2, 2.28, R, 0.78);
  wheel(-5.2, -2.28, R, 0.78);
  fender(-5.2, 2.28, R, 0.86, 0.35, Math.PI - 0.2);
  fender(-5.2, -2.28, R, 0.86, 0.35, Math.PI - 0.2);
  rod([-5.2, R, -1.95], [-5.2, R, 1.95], 0.2, frame);
  for (const s of [1, -1]) beam([-6.0, 1.3, 1.55 * s], [-7.1, 1.35, 0.6 * s], 0.22, 0.32, frame);
  // Bloque de empuje
  slab(
    [
      [-7.0, 0.95],
      [-7.45, 1.05],
      [-7.55, 1.4],
      [-7.45, 1.95],
      [-7.0, 2.05],
    ],
    1.5,
    -0.75,
    frame,
    undefined,
    0.04,
  );
  box(0.06, 0.7, 1.3, [-7.57, 1.45, 0], steel);
  for (const s of [1, -1]) box(0.04, 0.12, 0.18, [-7.47, 1.95, 0.55 * s], tail);

  // Sombras: todo proyecta y recibe. Aristas finas sobre lámina y bastidor, como en un modelo CAD.
  const edgeMat = keep(new THREE.LineBasicMaterial({ color: 0x2a2110, transparent: true, opacity: 0.32 }));
  const outlined = new Set<THREE.Material>([paint, frame, steel, ...Object.values(zonePaint)]);
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

  return {
    root,
    zones,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
