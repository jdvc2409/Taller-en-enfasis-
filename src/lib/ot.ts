// Órdenes de trabajo: creación automática desde un punto, flujo de estados y cierre con registro de la reparación.
// Los tiempos y materiales son una PLANTILLA DE REFERENCIA, no un procedimiento aprobado.
import type { DB, Inspection, InspectionEvent, WOMaterial, WOOperation, WOState, WorkOrder } from '../types';
import { addDays, fmtH, STATUS_LABEL, type PointAnalysis, type UnitAnalysis } from './analysis';
import { isFractureComment } from './importer';

export const WO_STATES: { id: WOState; label: string; help: string }[] = [
  { id: 'notificacion', label: 'Notificación', help: 'Aviso generado por la inspección; pendiente de aprobación.' },
  { id: 'abierta', label: 'OT abierta', help: 'Aprobada: se convierte en orden de trabajo.' },
  { id: 'planeada', label: 'Planeada', help: 'Planeación: qué se hace, con qué recursos, materiales y tiempos.' },
  { id: 'programada', label: 'Programada', help: 'Programación: cuándo se hace y quién lo hace.' },
  { id: 'ejecutada', label: 'Ejecutada', help: 'Trabajo realizado; falta el reporte y el cierre.' },
  { id: 'cerrada', label: 'Cerrada', help: 'Reporte entregado y END final aceptado.' },
];
export const stateLabel = (s: WOState) => WO_STATES.find((x) => x.id === s)!.label;
export const nextState = (s: WOState): WOState | null => {
  const i = WO_STATES.findIndex((x) => x.id === s);
  return i >= 0 && i < WO_STATES.length - 1 ? WO_STATES[i + 1].id : null;
};

export const ISO = {
  failureMode: ['STD — Deficiencia estructural', 'BRD — Avería grave (rotura)'],
  mechanism: ['2.6 Fatiga', '2.5 Rotura'],
  cause: [
    '3.4 Desgaste y deterioro esperado',
    '3.3 Error de mantenimiento (reparación previa deficiente), presunta: confirmar con análisis de causa raíz',
    '1.1 Capacidad inadecuada (diseño), presunta: confirmar con análisis de causa raíz',
    '3.1 Operación fuera de diseño (sobrecarga), presunta: confirmar con análisis de causa raíz',
  ],
  detection: ['Inspección periódica (visual / END)'],
  activity: ['2 Reparación', '11 Combinación (reparación + modificación con refuerzo)'],
};

export const MAINTENANCE_TYPES = [
  'Correctivo inmediato',
  'Correctivo diferido',
  'Preventivo basado en condición (hallazgo de inspección → restauración programada)',
  'Preventivo basado en condición (monitoreo)',
];

const uid = () => Math.random().toString(36).slice(2, 9);
const r1 = (n: number) => Math.round(n * 10) / 10;
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function nextWOId(db: DB) {
  const n = db.workOrders.reduce((m, w) => Math.max(m, Number(w.id.replace(/\D/g, '')) || 0), 0) + 1;
  return `OT-${String(n).padStart(4, '0')}`;
}

/** Operaciones de referencia; los tiempos escalan con k = max(0,5; L/100). */
export function templateOperations(L: number, reinforce: boolean): WOOperation[] {
  const k = Math.max(0.5, L / 100);
  const ops: WOOperation[] = [
    {
      id: uid(),
      text: 'Seguridad y preparación: bajar la compuerta o la caja a tierra o calzarla mecánicamente (nunca confiar en el cilindro), LOTO, liberar la energía hidráulica almacenada, permiso de trabajo en caliente y limpieza de la zona.',
      people: 2,
      hours: 1.5,
    },
    { id: uid(), text: 'END inicial (MT/PT) para ubicar la punta real de la grieta.', people: 1, hours: 1 },
    {
      id: uid(),
      text: 'Perforaciones de alivio en las puntas y arco-aire hasta metal sano; verificar con MT/PT. Vigía contra incendio y extracción de humos.',
      people: 1,
      hours: r1(1 + 0.6 * k),
    },
    {
      id: uid(),
      text: 'Precalentamiento y soldadura según WPS calificada (AWS D14.3 / D1.1) con soldador calificado; E7018 de horno; controlar temperatura entre pasadas.',
      people: 1,
      hours: r1(2 + 1.2 * k),
    },
  ];
  if (reinforce) {
    ops.push({
      id: uid(),
      text: 'Placa de refuerzo según diseño aprobado por ingeniería u OEM (extremos ahusados para no crear concentradores de esfuerzo).',
      people: 2,
      hours: r1(2 + 0.5 * k),
    });
  }
  ops.push(
    { id: uid(), text: 'Esmerilado y END final (idealmente 24 a 48 h después, por fisuración por hidrógeno).', people: 2, hours: 1.5 },
    { id: uid(), text: 'Registro de la intervención y cierre de la OT.', people: 1, hours: 0.5 },
  );
  return ops;
}

export function templateMaterials(L: number, reinforce: boolean): WOMaterial[] {
  const m: WOMaterial[] = [
    { id: uid(), text: 'Electrodo E7018 (conservado en horno)', qty: Math.max(2, Math.ceil(L / 150) + 1), unit: 'kg' },
    { id: uid(), text: 'Electrodos de carbón para arco-aire', qty: Math.max(5, Math.ceil(L / 50)), unit: 'u' },
    { id: uid(), text: 'Discos de corte y desbaste', qty: 6, unit: 'u' },
    { id: uid(), text: 'Kit de END (MT o PT)', qty: 1, unit: 'kit' },
    { id: uid(), text: 'Crayones térmicos para precalentamiento', qty: 2, unit: 'u' },
  ];
  if (reinforce) m.push({ id: uid(), text: 'Placa de refuerzo (material y espesor según diseño aprobado)', qty: 1, unit: 'u' });
  return m;
}

export function createWorkOrder(db: DB, pa: PointAnalysis, unit: UnitAnalysis): WorkOrder {
  const L = pa.length ?? 0;
  const lastComment = [...pa.series].reverse().find((s) => s.comment && !s.repaired)?.comment ?? '';
  const broken = pa.fractured || isFractureComment(lastComment);
  const reinforce = pa.recurrent || broken;
  const created = today();
  const Tp = pa.toDanger.pessimistic;
  // Fecha límite: antes de que el escenario pesimista llegue a Danger (desde la última inspección).
  const due =
    pa.status === 'critico' || Tp === 0
      ? created
      : Tp != null && unit.usageForecast && unit.nowDate
        ? addDays(unit.nowDate, Tp / unit.usageForecast)
        : null;
  const maintenanceType =
    pa.status === 'critico'
      ? MAINTENANCE_TYPES[0]
      : pa.status === 'alerta'
        ? MAINTENANCE_TYPES[2]
        : MAINTENANCE_TYPES[3];
  const p = pa.point;
  const desc = [
    `${p.code} (${p.description}): grieta de ${L} mm, estado ${STATUS_LABEL[pa.status]} (Caution ${p.caution} mm, Danger ${p.danger} mm), medida el ${pa.lastDate}.`,
    pa.rate != null ? `Ritmo ${pa.rate.toFixed(1).replace('.', ',')} mm por cada 100 h.` : '',
    pa.status === 'critico'
      ? 'Supera Danger: reparar antes de continuar operando (equipo fuera de servicio).'
      : Tp != null
        ? `Pronóstico: Danger en ${fmtH(pa.toDanger.central ?? Tp)} h (pesimista ${fmtH(Tp)} h).`
        : '',
    lastComment ? `Comentario del inspector: "${lastComment}".` : '',
    pa.recurrent ? `Punto reincidente (${pa.kpis.repairs} reparaciones): requiere análisis de causa raíz.` : '',
    pa.rcaRequired && !pa.recurrent ? 'Operó sobre Danger o se fracturó: requiere análisis de causa raíz.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const zone = db.zones.find((z) => z.id === p.zone);
  return {
    id: nextWOId(db),
    pointKey: p.key,
    state: 'notificacion',
    history: [{ state: 'notificacion', at: new Date().toISOString() }],
    createdAt: created,
    dueDate: due,
    scheduledDate: pa.priority === 'P1' ? created : null,
    priority: pa.priority,
    maintenanceType,
    notificationType: 'Inspección',
    description: desc,
    location: `${unit.model} ${p.unit} / ${zone?.name ?? p.zone} / ${p.code}`,
    statusAtCreation: pa.status,
    lengthAtCreation: pa.length,
    failureMode: broken ? ISO.failureMode[1] : ISO.failureMode[0],
    mechanism: broken ? ISO.mechanism[1] : ISO.mechanism[0],
    cause: pa.recurrent ? ISO.cause[1] : ISO.cause[0],
    detection: ISO.detection[0],
    activity: reinforce ? ISO.activity[1] : ISO.activity[0],
    operations: templateOperations(L, reinforce),
    materials: templateMaterials(L, reinforce),
    rate: db.settings.rate,
    report: '',
    closeDate: null,
    closeHours: null,
  };
}

export function advanceWO(wo: WorkOrder): WorkOrder {
  const n = nextState(wo.state);
  if (!n) return wo;
  return { ...wo, state: n, history: [...wo.history, { state: n, at: new Date().toISOString() }] };
}

export interface CloseInput {
  date: string;
  hours: number;
  report: string;
  register: boolean;
  /** END final aceptado: sin indicaciones. Si no, se registra la longitud residual. */
  ndtOk: boolean;
  residual: number | null;
}

/** Cierra la OT y, si se pide, registra la reparación (L = 0) o la longitud residual en el historial. */
export function closeWO(db: DB, wo: WorkOrder, c: CloseInput): DB {
  const closed: WorkOrder = {
    ...wo,
    state: 'cerrada',
    history: [...wo.history, ...(wo.state !== 'ejecutada' ? [{ state: 'ejecutada' as const, at: new Date().toISOString() }] : []), { state: 'cerrada', at: new Date().toISOString() }],
    report: c.report,
    closeDate: c.date,
    closeHours: c.hours,
  };
  let next: DB = { ...db, workOrders: db.workOrders.map((w) => (w.id === wo.id ? closed : w)) };
  if (!c.register) return next;
  const [unit, code] = wo.pointKey.split('|');
  const evId = `${unit}|${c.date}`;
  const ev = next.events.find((e) => e.id === evId);
  const events: InspectionEvent[] = ev
    ? next.events.map((e) => (e.id === evId && e.hours == null ? { ...e, hours: c.hours } : e))
    : [
        ...next.events,
        { id: evId, unit, date: c.date, hours: c.hours, inspector: 'Mantenimiento', notes: `Cierre de ${wo.id}`, zoneNotes: {}, flags: [], source: 'ot' as const },
      ].sort((a, b) => a.date.localeCompare(b.date));
  const id = `${unit}|${code}|${c.date}`;
  const rec: Inspection = {
    id,
    unit,
    code,
    date: c.date,
    length: c.ndtOk ? 0 : c.residual,
    repaired: c.ndtOk,
    comment: c.ndtOk
      ? `Zona reparada por soldadura (${wo.id}). END final aceptado.`
      : `Intervención ${wo.id} con END final con indicación: longitud residual ${c.residual ?? 'N/I'} mm.`,
    image: '',
    photos: [],
    excluded: false,
    flags: [],
    source: 'ot',
  };
  next = {
    ...next,
    events,
    inspections: [...next.inspections.filter((i) => i.id !== id), rec],
  };
  return next;
}
