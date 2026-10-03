// Motor de análisis. Todo se recalcula a partir de los datos y de una fecha de corte opcional
// (máquina del tiempo): con corte, solo cuentan las inspecciones con fecha ≤ corte.
import type { DB, Flag, Inspection, InspectionEvent, Point, Settings, Status, WorkOrder, Zone } from '../types';
import { DAY_MS, daysBetween, growthPairs, median, runQuality } from './quality';
import { isFractureComment } from './importer';

// ---------------------------------------------------------------- utilidades

export const STATUS_RANK: Record<Status, number> = { ni: 0, sin: 1, normal: 2, alerta: 3, critico: 4 };
export const STATUS_LABEL: Record<Status, string> = {
  ni: 'N/I',
  sin: 'Sin grieta',
  normal: 'Normal',
  alerta: 'Alerta',
  critico: 'Crítico',
};

export function statusOf(L: number | null, p: Pick<Point, 'caution' | 'danger'>): Status {
  if (L == null) return 'ni';
  if (L === 0) return 'sin';
  if (L >= p.danger) return 'critico';
  if (L >= p.caution) return 'alerta';
  return 'normal';
}

export const worst = (xs: Status[]): Status =>
  xs.reduce<Status>((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), 'ni');

export function addDays(date: string, days: number) {
  const d = new Date(Date.parse(date) + Math.round(days) * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** t de Student de dos colas al 90 % (t_0.95) por grados de libertad. */
const T90 = [
  6.314, 2.92, 2.353, 2.132, 2.015, 1.943, 1.895, 1.86, 1.833, 1.812, 1.796, 1.782, 1.771, 1.761, 1.753, 1.746, 1.74,
  1.734, 1.729, 1.725, 1.721, 1.717, 1.714, 1.711, 1.708, 1.706, 1.703, 1.701, 1.699, 1.697,
];
export function t90(df: number) {
  if (df < 1) return Infinity;
  if (df <= 30) return T90[Math.floor(df) - 1];
  if (df <= 60) return 1.684; // gl = 40, conservador
  return df <= 120 ? 1.671 : 1.645;
}
/** La banda se limita a t = 3: con n = 3 la t vale 6,3 y la banda explota. */
export const T_CAP = 3;

// ---------------------------------------------------------------- tipos de salida

export interface SeriesItem {
  id: string;
  date: string;
  hours: number | null;
  length: number | null;
  /** Estado de la medida tal como se midió. */
  status: Status;
  /** Mayor medida del ciclo hasta esta fecha (una grieta no se cierra sin reparación). */
  effLength: number | null;
  /** Estado efectivo: con la mayor medida del ciclo, y Crítico si hay fractura reportada. */
  effStatus: Status;
  repaired: boolean;
  excluded: boolean;
  override?: 'include' | 'exclude';
  flags: Flag[];
  cycle: number;
  inspector: string;
  comment: string;
  photos: string[];
  row?: number;
  eventFlags: Flag[];
}

export type FitModel = 'lineal' | 'exponencial' | 'dos-medidas' | 'una-medida' | 'ritmo-referencia' | 'estable' | 'sin-datos';

export interface Fit {
  model: FitModel;
  n: number;
  /** Horómetro de la primera medida usada (h se mide desde aquí). */
  h0: number;
  a: number;
  b: number;
  se: number;
  t: number;
  r2: number | null;
  /** Ritmo actual en mm por cada 100 h. */
  rate: number;
  confidence: 'alta' | 'media' | 'baja';
  center: (hAbs: number) => number;
  upper: (hAbs: number) => number;
  lower: (hAbs: number) => number;
  note: string;
  used: { hours: number; length: number }[];
}

export interface Crossing {
  /** Horas desde el horómetro actual. 0 = ya superado; null = no cruza en 15.000 h. */
  central: number | null;
  pessimistic: number | null;
  optimistic: number | null;
  date: string | null;
  datePess: string | null;
  dateOpt: string | null;
}

export interface Alert {
  level: Severity3;
  text: string;
}
type Severity3 = 'error' | 'warn' | 'info';

export interface PointKPIs {
  repairs: number;
  repairEvery: number | null; // h por reparación
  reappearMean: number | null; // h desde reparar hasta volver a detectar
  lifeMean: number | null; // h desde detectar hasta reparar
  dangerConfirmed: number; // h entre la primera y la última medida crítica de cada episodio
  dangerMax: number; // h hasta la reparación o el corte
  dangerUpper: number; // cota superior: desde la última medida bajo Danger antes del episodio
  dangerEpisodes: number;
  dangerOpen: boolean;
}

export interface PointAnalysis {
  point: Point;
  zone: Zone;
  series: SeriesItem[];
  status: Status;
  length: number | null;
  lastDate: string | null;
  lastHours: number | null;
  lastNI: boolean;
  statusNote: string;
  hasCrack: boolean;
  cycleCount: number;
  fit: Fit;
  toCaution: Crossing;
  toDanger: Crossing;
  rate: number | null;
  urgency: number;
  consequence: number;
  score: number;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  priorityName: string;
  priorityWhy: string;
  action: string;
  nextInspection: number | null;
  alerts: Alert[];
  kpis: PointKPIs;
  recurrent: boolean;
  /** Fractura o grieta pasante reportada en el ciclo actual. */
  fractured: boolean;
  /** La banda pesimista ya supera Danger al horómetro actual, pero no hay medida que lo confirme. */
  unverified: boolean;
  /** Requiere análisis de causa raíz: reincidente, operó sobre Danger o se fracturó. */
  rcaRequired: boolean;
  openWO?: WorkOrder;
}

export interface EventSummary {
  event: InspectionEvent;
  worst: Status;
  measured: number;
  ni: number;
  repairs: number;
  sinceHours: number | null;
  sinceDays: number | null;
  onTime: boolean | null;
  criticalOpen: string[]; // puntos que estaban críticos al iniciar el intervalo hacia esta inspección
  riskyNI: string[]; // puntos en Alerta o Crítico que quedaron N/I en esta inspección
}

export interface Finding {
  id: string;
  severity: Severity3;
  title: string;
  text: string;
  points: string[];
}

export interface UnitAnalysis {
  unitId: string;
  model: string;
  nowHours: number | null;
  /** El horómetro actual se estimó (la última inspección no tiene horómetro válido). */
  nowEstimated: boolean;
  nowDate: string | null;
  firstHours: number | null;
  firstDate: string | null;
  usage: number | null; // h/día (promedio global)
  usageForecast: number | null; // h/día para convertir horas a fecha: máx(global, últimos 3 intervalos)
  points: PointAnalysis[];
  events: EventSummary[];
  counts: Record<Status, number>;
  worst: Status;
  repairs: number;
  /** MTBF estructural tal como lo pide el encargo: horas observadas / reparaciones (tiempo medio entre reparaciones). */
  mtbf: number | null;
  /** Fallas = episodios sobre Danger o fracturas; MTBF de falla = horas observadas / fallas (definición del curso). */
  failures: number;
  mtbfFailure: number | null;
  observedHours: number | null;
  hoursWithCritical: number;
  hoursWithCriticalConfirmed: number;
  onTimePct: number | null;
  onTimeCount: [number, number];
  niCells: number;
  typicalRate: number | null;
  medianDays: number | null;
  findings: Finding[];
}

export interface FleetAnalysis {
  asOf: string | null;
  isPast: boolean;
  lastDate: string | null;
  units: UnitAnalysis[];
  points: PointAnalysis[];
  ranking: PointAnalysis[];
  findings: Finding[];
  inspections: Inspection[];
  events: InspectionEvent[];
  backlog: { open: number; hh: number; weeks: number; p1: number; closed: number };
  workOrders: WorkOrder[];
  settings: Settings;
}

// ---------------------------------------------------------------- ajuste y pronóstico

function ols(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  return { a, b, mx, sxx };
}

const RES_MM = 5; // resolución de la medida (mm)
const HORIZON = 15000; // h hacia adelante

export function fitCycle(
  used: { hours: number; length: number }[],
  fallbackRate: number | null,
  fallbackSource: string,
): Fit {
  const n = used.length;
  const base = { n, used, r2: null as number | null };
  if (n === 0) {
    const z = () => 0;
    return { ...base, model: 'sin-datos', h0: 0, a: 0, b: 0, se: 0, t: 0, rate: 0, confidence: 'baja', center: z, upper: z, lower: z, note: 'Sin medidas con grieta en el ciclo actual.' };
  }
  const last = used[n - 1];
  const linearFrom = (r: number, lo: number, hi: number, model: FitModel, note: string): Fit => ({
    ...base,
    model,
    h0: last.hours,
    a: last.length,
    b: r / 100,
    se: 0,
    t: 0,
    rate: r,
    confidence: 'baja',
    center: (h) => last.length + (r / 100) * (h - last.hours),
    upper: (h) => last.length + ((r * hi) / 100) * Math.max(h - last.hours, 0),
    lower: (h) => last.length + ((r * lo) / 100) * Math.max(h - last.hours, 0),
    note,
  });
  const stable = (note: string): Fit => {
    const c = () => last.length;
    return { ...base, model: 'estable', h0: last.hours, a: last.length, b: 0, se: 0, t: 0, rate: 0, confidence: 'baja', center: c, upper: c, lower: c, note };
  };
  // Una grieta de fatiga no se acorta: una pendiente ≤ 0 suele ser dispersión o error de medición.
  // En ese caso se proyecta con el ritmo de referencia (criterio conservador) en lugar de declararla estable.
  const noGrowth = (why: string): Fit =>
    fallbackRate != null && fallbackRate > 0
      ? linearFrom(
          fallbackRate,
          0.5,
          2,
          'ritmo-referencia',
          `${why} Una grieta de fatiga no se acorta, así que se proyecta desde la última medida con ${fallbackSource} (${fallbackRate.toFixed(1).replace('.', ',')} mm/100 h), banda ×0,5 a ×2. Confianza baja: verificar en campo.`,
        )
      : stable(`${why} No hay ritmo de referencia para proyectar: mantener seguimiento y verificar la medida en campo.`);

  if (n === 1) {
    if (fallbackRate == null || !(fallbackRate > 0)) return stable('Una sola medida y sin ritmo de referencia: no se puede proyectar.');
    return linearFrom(
      fallbackRate,
      0.5,
      2,
      'una-medida',
      `Una sola medida en el ciclo actual: se proyecta con ${fallbackSource} (${fallbackRate.toFixed(1).replace('.', ',')} mm/100 h), banda ×0,5 a ×2. Confianza baja.`,
    );
  }
  if (n === 2) {
    const [p, q] = used;
    const r = q.hours > p.hours ? ((q.length - p.length) / (q.hours - p.hours)) * 100 : 0;
    if (r <= 0) return noGrowth(`Dos medidas sin crecimiento (${p.length} → ${q.length} mm).`);
    return linearFrom(r, 0.6, 1.6, 'dos-medidas', `Recta entre 2 medidas (${r.toFixed(1).replace('.', ',')} mm/100 h), banda ×0,6 a ×1,6 del ritmo. Confianza baja.`);
  }

  // n ≥ 3: lineal y exponencial, h desde la primera medida.
  const h0 = used[0].hours;
  const x = used.map((u) => u.hours - h0);
  const y = used.map((u) => u.length);
  const meanL = y.reduce((s, v) => s + v, 0) / n;
  const sst = y.reduce((s, v) => s + (v - meanL) ** 2, 0);
  const t = Math.min(t90(n - 2), T_CAP);

  const lin = ols(x, y);
  const sseLin = y.reduce((s, v, i) => s + (v - (lin.a + lin.b * x[i])) ** 2, 0);
  const ly = y.map(Math.log);
  const ex = ols(x, ly);
  const sseExpMm = y.reduce((s, v, i) => s + (v - Math.exp(ex.a + ex.b * x[i])) ** 2, 0);
  const sseExpLog = ly.reduce((s, v, i) => s + (v - (ex.a + ex.b * x[i])) ** 2, 0);
  const useExp = ex.b > 0 && sseExpMm < 0.9 * sseLin;
  const lastL = y[n - 1];

  if (useExp) {
    const se = Math.max(Math.sqrt(sseExpLog / (n - 2)), RES_MM / meanL);
    const half = (h: number) => t * se * Math.sqrt(1 + 1 / n + (h - h0 - ex.mx) ** 2 / ex.sxx);
    const c = (h: number) => ex.a + ex.b * (h - h0);
    const rate = ex.b * lastL * 100;
    const r2 = sst > 0 ? 1 - sseExpMm / sst : null;
    return {
      ...base,
      r2,
      model: 'exponencial',
      h0,
      a: ex.a,
      b: ex.b,
      se,
      t,
      rate,
      confidence: n <= 3 ? 'baja' : n >= 5 && (r2 ?? 0) >= 0.8 ? 'alta' : 'media',
      center: (h) => Math.exp(c(h)),
      upper: (h) => Math.exp(c(h) + half(h)),
      lower: (h) => Math.exp(c(h) - half(h)),
      note: `Ajuste exponencial (ln L = a + b·h) con ${n} medidas del ciclo actual; R² = ${r2 == null ? '—' : r2.toFixed(3).replace('.', ',')}. Se eligió porque su error es menor que 0,9 × el del lineal: crecimiento acelerado coherente con la ley de Paris (da/dN ∝ ΔK^m). Banda de predicción del 90 % (t = ${t.toFixed(2).replace('.', ',')}).`,
    };
  }
  if (lin.b <= 0) {
    return noGrowth(`El ajuste lineal con ${n} medidas no tiene pendiente positiva (${(lin.b * 100).toFixed(1).replace('.', ',')} mm/100 h).`);
  }
  const se = Math.max(Math.sqrt(sseLin / (n - 2)), RES_MM);
  const half = (h: number) => t * se * Math.sqrt(1 + 1 / n + (h - h0 - lin.mx) ** 2 / lin.sxx);
  const c = (h: number) => lin.a + lin.b * (h - h0);
  const r2 = sst > 0 ? 1 - sseLin / sst : null;
  return {
    ...base,
    r2,
    model: 'lineal',
    h0,
    a: lin.a,
    b: lin.b,
    se,
    t,
    rate: lin.b * 100,
    confidence: n <= 3 ? 'baja' : n >= 5 && (r2 ?? 0) >= 0.8 ? 'alta' : 'media',
    center: c,
    upper: (h) => c(h) + half(h),
    lower: (h) => c(h) - half(h),
    note: `Ajuste lineal (L = a + b·h) con ${n} medidas del ciclo actual; R² = ${r2 == null ? '—' : r2.toFixed(3).replace('.', ',')}; ${(lin.b * 100).toFixed(1).replace('.', ',')} mm/100 h. Banda de predicción del 90 % (t de Student con ${n - 2} gl${t90(n - 2) > T_CAP ? ', limitada a 3' : ''}; error residual ${se.toFixed(1).replace('.', ',')} mm).`,
  };
}

/** Horas desde `now` hasta que f(h) ≥ limit (0 si ya lo supera; null si no cruza en 15.000 h). */
function crossHours(f: (h: number) => number, limit: number, now: number): number | null {
  if (f(now) >= limit) return 0;
  let prev = now;
  for (let step = 1; step <= HORIZON; step += 1) {
    const h = now + step;
    if (f(h) >= limit) {
      // refinar entre prev y h
      let lo = prev;
      let hi = h;
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (f(mid) >= limit) hi = mid;
        else lo = mid;
      }
      return hi - now;
    }
    prev = h;
  }
  return null;
}

function crossing(fit: Fit, limit: number, now: number, nowDate: string | null, usage: number | null): Crossing {
  const none = { central: null, pessimistic: null, optimistic: null, date: null, datePess: null, dateOpt: null };
  if (fit.model === 'sin-datos') return none;
  if (fit.model === 'estable') {
    const already = fit.center(now) >= limit ? 0 : null;
    return { ...none, central: already, pessimistic: already, optimistic: already, date: already === 0 ? nowDate : null };
  }
  const central = crossHours(fit.center, limit, now);
  const pessimistic = crossHours(fit.upper, limit, now);
  const optimistic = crossHours(fit.lower, limit, now);
  const toDate = (h: number | null) => (h == null || !nowDate || !usage ? null : addDays(nowDate, h / usage));
  return { central, pessimistic, optimistic, date: toDate(central), datePess: toDate(pessimistic), dateOpt: toDate(optimistic) };
}

// ---------------------------------------------------------------- prioridad

export function urgencyFrom(status: Status, Tpess: number | null) {
  let P = 1;
  if (status === 'critico') P = 5;
  else if (Tpess != null) {
    if (Tpess <= 250) P = 5;
    else if (Tpess <= 500) P = 4;
    else if (Tpess <= 1000) P = 3;
    else if (Tpess <= 2500) P = 2;
  }
  if (status === 'alerta') P = Math.max(P, 3);
  if (status === 'normal') P = Math.max(P, 2);
  return P;
}

export function priorityFrom(status: Status, score: number): ['P1' | 'P2' | 'P3' | 'P4', string] {
  if (status === 'critico' || score >= 20) return ['P1', 'Inmediata'];
  if (score >= 12) return ['P2', 'Esta semana'];
  if (score >= 6) return ['P3', 'Próximo mes'];
  return ['P4', 'Seguimiento'];
}

export const fmtH = (h: number) => Math.round(h).toLocaleString('es-CO');

// ---------------------------------------------------------------- análisis por punto

function analyzePoint(
  point: Point,
  zone: Zone,
  insps: Inspection[],
  evById: Map<string, InspectionEvent>,
  lastEvent: InspectionEvent | null,
  nowHours: number | null,
  usage: number | null,
  typicalRate: number | null,
  settings: Settings,
  hoursOf: (date: string) => number | null,
): PointAnalysis {
  const seq = insps.filter((i) => i.code === point.code).sort((a, b) => a.date.localeCompare(b.date));
  // Estado efectivo: una grieta no se cierra sola. Dentro de un ciclo (entre reparaciones) se usa la mayor
  // medida válida hasta la fecha (sin contar atípicos), y una fractura reportada deja el punto Crítico.
  // Solo una reparación baja el estado. Las exclusiones manuales afectan la tendencia, no el estado.
  let cycle = 0;
  let runMax = 0;
  let runFracture = false;
  const series: SeriesItem[] = seq.map((i) => {
    if (i.repaired) {
      cycle++;
      runMax = 0;
      runFracture = false;
    }
    const ev = evById.get(`${i.unit}|${i.date}`);
    const hours = hoursOf(i.date);
    const atip = i.flags.some((f) => f.type === 'atipico');
    if (i.length != null && !i.repaired && !atip) runMax = Math.max(runMax, i.length);
    if (!i.repaired && isFractureComment(i.comment)) runFracture = true;
    const effLength = i.length == null ? null : i.repaired ? 0 : Math.max(i.length, runMax);
    const effStatus: Status = i.length == null ? 'ni' : runFracture ? 'critico' : statusOf(effLength, point);
    return {
      id: i.id,
      date: i.date,
      hours,
      length: i.length,
      status: statusOf(i.length, point),
      effLength,
      effStatus,
      repaired: i.repaired,
      excluded: i.excluded,
      override: i.override,
      flags: i.flags,
      cycle,
      inspector: ev?.inspector ?? '',
      comment: i.comment,
      photos: i.photos,
      row: i.row,
      eventFlags: ev?.flags ?? [],
    };
  });
  const valid = series.filter((s) => s.length != null);
  const included = valid.filter((s) => !s.excluded);
  const curCycle = series.length ? series[series.length - 1].cycle : 0;

  const lastValid = valid[valid.length - 1];
  let status: Status = lastValid?.effStatus ?? 'ni';
  const length = lastValid?.effLength ?? null;
  const lastDate = lastValid?.date ?? null;
  const lastHours = lastValid?.hours ?? null;
  const notes: string[] = [];
  const fracture = series.find((s) => s.cycle === curCycle && !s.repaired && isFractureComment(s.comment));
  const fractured = !!fracture;
  if (lastValid && lastValid.effLength! > lastValid.length!) {
    notes.push(
      `La última medida (${lastValid.length} mm) es menor que la mayor del ciclo sin reparación registrada; hasta confirmarla en campo el estado usa ${lastValid.effLength} mm.`,
    );
  }
  if (lastValid?.excluded) notes.push('La última medida está excluida de la tendencia, pero sigue contando para el estado.');
  if (fracture) {
    status = 'critico';
    notes.push(`El inspector reportó "${fracture.comment}" el ${fracture.date}: Crítico por criterio del formato.`);
  }
  const lastNI = !!lastEvent && !seq.some((i) => i.date === lastEvent.date && i.length != null);
  if (lastNI && lastEvent) notes.push(`No se inspeccionó el ${lastEvent.date}: el estado corresponde a la medida del ${lastDate ?? '—'}.`);
  const statusNote = notes.join(' ');
  const hasCrack = (length != null && length > 0) || fractured;

  // Ciclo actual y ritmo histórico del punto.
  const used = included
    .filter((s) => s.cycle === curCycle && (s.length ?? 0) > 0 && s.hours != null)
    .map((s) => ({ hours: s.hours!, length: s.length! }));
  const pastRates: number[] = [];
  for (let c = 0; c < curCycle; c++) {
    const r = growthPairs(
      series.filter((s) => s.cycle === c).map((s) => ({ length: s.length, repaired: false, hours: s.hours, skip: s.excluded })),
    );
    if (r.length) pastRates.push(median(r));
  }
  const ownRate = pastRates.length ? median(pastRates) : null;
  const fallback = ownRate ?? typicalRate;
  const fit = hasCrack
    ? fitCycle(used, fallback, ownRate != null ? 'el ritmo histórico del punto (mediana de ciclos anteriores)' : 'el ritmo típico del equipo')
    : fitCycle([], null, '');

  const now = nowHours ?? lastHours ?? 0;
  const nowDate = lastEvent?.date ?? lastDate;
  let toCaution = crossing(fit, point.caution, now, nowDate, usage);
  let toDanger = crossing(fit, point.danger, now, nowDate, usage);
  if (status === 'critico' || status === 'alerta') {
    toCaution = { central: 0, pessimistic: 0, optimistic: 0, date: lastDate, datePess: lastDate, dateOpt: lastDate };
  }
  if (status === 'critico') {
    toDanger = { central: 0, pessimistic: 0, optimistic: 0, date: lastDate, datePess: lastDate, dateOpt: lastDate };
  }
  const rate = hasCrack && fit.model !== 'sin-datos' ? fit.rate : null;
  // Si el punto no se midió hasta el horómetro actual y la banda pesimista ya pasó Danger, puede estar crítico sin saberlo.
  const unverified = status !== 'critico' && hasCrack && toDanger.pessimistic === 0 && (lastHours ?? now) < now;

  // KPIs del punto.
  const repairsList = series.filter((s) => s.repaired);
  const firstH = series.find((s) => s.hours != null)?.hours ?? null;
  const reappear: number[] = [];
  const life: number[] = [];
  for (const r of repairsList) {
    const nextDet = included.find((s) => s.cycle === r.cycle && (s.length ?? 0) > 0 && s.hours != null);
    if (nextDet && r.hours != null) reappear.push(nextDet.hours! - r.hours);
    const det = included.find((s) => s.cycle === r.cycle - 1 && (s.length ?? 0) > 0 && s.hours != null);
    if (det && r.hours != null) life.push(r.hours - det.hours!);
  }
  // Horas sobre Danger por episodio: confirmadas (primera a última medida crítica), hasta la reparación o el corte,
  // y cota superior (desde la última medida bajo Danger antes del episodio).
  let dangerConfirmed = 0;
  let dangerMax = 0;
  let dangerUpper = 0;
  let dangerEpisodes = 0;
  let open: { start: number; last: number; before: number } | null = null;
  let lastBelow: number | null = null;
  for (const s of valid) {
    if (s.hours == null) continue;
    if (s.effStatus === 'critico') {
      if (!open) {
        open = { start: s.hours, last: s.hours, before: lastBelow ?? s.hours };
        dangerEpisodes++;
      } else open.last = s.hours;
    } else {
      if (open) {
        dangerConfirmed += open.last - open.start;
        dangerMax += s.hours - open.start;
        dangerUpper += s.hours - open.before;
        open = null;
      }
      lastBelow = s.hours;
    }
  }
  const dangerOpen = !!open;
  if (open) {
    const end = Math.max(now, open.last);
    dangerConfirmed += open.last - open.start;
    dangerMax += end - open.start;
    dangerUpper += end - open.before;
  }
  const kpis: PointKPIs = {
    repairs: repairsList.length,
    repairEvery: repairsList.length && firstH != null ? (now - firstH) / repairsList.length : null,
    reappearMean: reappear.length ? reappear.reduce((a, b) => a + b, 0) / reappear.length : null,
    lifeMean: life.length ? life.reduce((a, b) => a + b, 0) / life.length : null,
    dangerConfirmed,
    dangerMax,
    dangerUpper,
    dangerEpisodes,
    dangerOpen,
  };
  const recurrent = repairsList.length >= 2;
  const everFractured = series.some((s) => isFractureComment(s.comment));
  const rcaRequired = recurrent || dangerEpisodes > 0 || everFractured;

  // Prioridad = urgencia (probabilidad) × consecuencia.
  const Tp = toDanger.pessimistic;
  const urgency = hasCrack || status === 'critico' ? urgencyFrom(status, Tp) : 1;
  const consequence = point.criticality ?? zone.criticality;
  const score = urgency * consequence;
  const tooClose = status !== 'critico' && hasCrack && Tp != null && Tp <= 200;
  let [priority, priorityName] = priorityFrom(status, score);
  // Si la acción es reparar ya, restringir o inspeccionar antes de operar, la prioridad no puede ser menor que P1.
  if (unverified || tooClose) [priority, priorityName] = ['P1', 'Inmediata'];
  const cWhy = point.criticality != null ? ` (consecuencia propia del punto: ${point.criticalityReason ?? 'definida en Datos'})` : '';
  const priorityWhy =
    status === 'critico'
      ? `Crítico${fractured ? ' (fractura reportada)' : ' (L ≥ Danger)'}: P1 por criterio del formato. Urgencia ${urgency} × consecuencia ${consequence} = ${score}${cWhy}.`
      : `Urgencia ${urgency} × consecuencia ${consequence} = ${score}${cWhy}` +
        (Tp != null && hasCrack ? `; escenario pesimista: Danger en ${fmtH(Tp)} h.` : '.') +
        (unverified
          ? ' P1 porque puede estar crítico sin verificar.'
          : tooClose
            ? ' P1 porque el escenario pesimista llega a Danger en ≤ 200 h.'
            : '');

  // Próxima inspección: la mitad del tiempo pesimista restante (tolerancia al daño), sin pasar del intervalo objetivo.
  // Sin piso: si la mitad del tiempo es muy corta, la acción es reparar o restringir, no reinspeccionar.
  let nextInspection: number | null = settings.targetInterval;
  if (status === 'critico') nextInspection = null;
  else if (hasCrack && Tp != null) nextInspection = Math.min(Tp / 2, settings.targetInterval);
  if (nextInspection != null) nextInspection = Math.max(0, Math.floor(nextInspection / 10) * 10);

  // Acción recomendada (palabras del formato).
  let action: string;
  if (status === 'critico') action = 'Reparar antes de continuar operando (sacar de servicio).';
  else if (unverified)
    action = `Posible crítico no verificado: inspeccionar antes de seguir operando (la banda pesimista ya supera Danger al horómetro actual).`;
  else if (tooClose)
    action =
      Tp === 0
        ? 'Reparar ya o restringir la operación: el escenario pesimista ya alcanza Danger.'
        : `Reparar ya o restringir la operación: el escenario pesimista llega a Danger en ${fmtH(Tp!)} h, antes de una reinspección útil.`;
  else if (status === 'alerta')
    action =
      Tp != null
        ? `Programar reparación antes de ${fmtH(Tp)} h y reinspeccionar en ≤ ${fmtH(nextInspection!)} h.`
        : `Programar reparación y reinspeccionar en ≤ ${fmtH(nextInspection!)} h.`;
  else if (status === 'normal') action = `Seguimiento: reinspeccionar en ≤ ${fmtH(nextInspection!)} h.`;
  else if (status === 'sin')
    action = rcaRequired
      ? `Sin grieta. ${recurrent ? 'Punto reincidente' : 'Operó sobre Danger o se fracturó'}: análisis de causa raíz antes de la próxima reparación.`
      : 'Sin grieta: seguimiento en la frecuencia normal.';
  else action = 'Sin medidas válidas: inspeccionar en la próxima parada.';
  if (lastNI && status !== 'ni' && !unverified) action += ' No se midió en la última inspección: priorizar el acceso en la próxima.';

  // Alertas.
  const alerts: Alert[] = [];
  if (status === 'critico')
    alerts.push({
      level: 'error',
      text: fractured
        ? `Fractura o grieta pasante reportada (${fracture!.date}). Reparar antes de continuar operando.`
        : `Supera Danger (${length} ≥ ${point.danger} mm). Reparar antes de continuar operando.`,
    });
  if (unverified) alerts.push({ level: 'error', text: 'Posible crítico no verificado: la proyección pesimista ya supera Danger y no hay medida reciente.' });
  if (status === 'alerta') alerts.push({ level: 'warn', text: `En Alerta (${length} ≥ Caution ${point.caution} mm). Aumentar frecuencia de inspección y programar reparación.` });
  if (status === 'normal' && length != null && length >= settings.nearCaution * point.caution)
    alerts.push({ level: 'warn', text: `Cerca de Caution: ${length} mm es el ${Math.round((length / point.caution) * 100)} % del límite.` });
  if (rate != null && rate >= settings.fastGrowth)
    alerts.push({ level: 'warn', text: `Crece rápido: ${rate.toFixed(1).replace('.', ',')} mm por cada 100 h (umbral ${settings.fastGrowth}).` });
  if (status !== 'critico' && Tp != null && Tp < settings.alertWindow)
    alerts.push({ level: 'warn', text: `Puede llegar a Danger en menos de ${fmtH(settings.alertWindow)} h (pesimista: ${fmtH(Tp)} h).` });
  if (lastNI) alerts.push({ level: status === 'alerta' || status === 'critico' ? 'error' : 'warn', text: 'No inspeccionado en la última inspección (N/I). Un punto N/I no es un punto sano.' });
  const lastMeasuredH = valid.filter((s) => s.hours != null).slice(-1)[0]?.hours;
  if (lastMeasuredH != null && now - lastMeasuredH > 1.5 * settings.targetInterval)
    alerts.push({ level: 'warn', text: `Sin medición hace ${fmtH(now - lastMeasuredH)} h (más de 1,5 × el intervalo objetivo).` });
  if (recurrent) alerts.push({ level: 'info', text: `Reincidente: ${repairsList.length} reparaciones. Requiere análisis de causa raíz.` });
  else if (rcaRequired) alerts.push({ level: 'info', text: 'Operó sobre Danger o se fracturó: requiere análisis de causa raíz aunque tenga una sola reparación.' });

  return {
    point,
    zone,
    series,
    status,
    length,
    lastDate,
    lastHours,
    lastNI,
    statusNote,
    hasCrack,
    cycleCount: curCycle + 1,
    fit,
    toCaution,
    toDanger,
    rate,
    urgency,
    consequence,
    score,
    priority,
    priorityName,
    priorityWhy,
    action,
    nextInspection,
    alerts,
    kpis,
    recurrent,
    fractured,
    unverified,
    rcaRequired,
  };
}

// ---------------------------------------------------------------- análisis por equipo

function unionLength(ivs: [number, number][]) {
  const xs = [...ivs].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const iv of xs) {
    if (!cur || iv[0] > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [iv[0], iv[1]];
    } else cur[1] = Math.max(cur[1], iv[1]);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

const fmtD = (d: string) => {
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

function analyzeUnit(
  unitId: string,
  model: string,
  db: DB,
  events: InspectionEvent[],
  inspections: Inspection[],
  typicalRate: number | null,
  medianDays: number | null,
): UnitAnalysis {
  const s = db.settings;
  const evs = events.filter((e) => e.unit === unitId).sort((a, b) => a.date.localeCompare(b.date));
  const goodEvs = evs.filter((e) => e.hours != null && !e.flags.some((f) => f.type === 'horometro' && f.severity === 'error'));
  const evById = new Map(evs.map((e) => [e.id, e]));
  const lastEvent = evs[evs.length - 1] ?? null;
  const lastGood = goodEvs[goodEvs.length - 1] ?? null;
  const firstGood = goodEvs[0] ?? null;
  const days = firstGood && lastGood ? daysBetween(firstGood.date, lastGood.date) : 0;
  const usage = firstGood && lastGood && days > 0 ? (lastGood.hours! - firstGood.hours!) / days : null;
  // Para convertir horas a fecha se usa el mayor entre el uso global y el de los últimos 3 intervalos:
  // si el equipo trabaja más ahora, la fecha estimada no debe salir tarde.
  const recent = goodEvs.slice(-4);
  const recentDays = recent.length > 1 ? daysBetween(recent[0].date, recent[recent.length - 1].date) : 0;
  const recentUsage = recentDays > 0 ? (recent[recent.length - 1].hours! - recent[0].hours!) / recentDays : null;
  const usageForecast = usage == null ? recentUsage : Math.max(usage, recentUsage ?? 0);
  // Horómetro actual: el de la última inspección válida. Si la última tiene horómetro inválido o vacío,
  // se estima con los días transcurridos × uso, para no subestimar las horas operadas desde entonces.
  let nowHours = lastGood?.hours ?? null;
  const nowEstimated = !!(lastEvent && lastGood && lastEvent.id !== lastGood.id && usageForecast);
  if (nowEstimated) nowHours = lastGood!.hours! + daysBetween(lastGood!.date, lastEvent!.date) * usageForecast!;
  // Horas de cada inspección; si su horómetro es inválido, se estiman desde la anterior válida (para exposición, no para el ajuste).
  const hoursOf = (date: string): number | null => {
    const e = evById.get(`${unitId}|${date}`);
    if (e && goodEvs.includes(e)) return e.hours;
    const prev = goodEvs.filter((g) => g.date < date).slice(-1)[0];
    return prev && usageForecast ? prev.hours! + daysBetween(prev.date, date) * usageForecast : null;
  };
  const insps = inspections.filter((i) => i.unit === unitId);
  const zones = new Map(db.zones.map((z) => [z.id, z]));
  const points = db.points
    .filter((p) => p.unit === unitId)
    .sort((a, b) => (zones.get(a.zone)?.order ?? 0) - (zones.get(b.zone)?.order ?? 0) || a.code.localeCompare(b.code))
    .map((p) => {
      const zone = zones.get(p.zone) ?? { id: p.zone, name: p.zone, criticality: 3, reason: '', image: '', order: 99 };
      return analyzePoint(p, zone, insps, evById, lastEvent, nowHours, usageForecast, typicalRate, s, hoursOf);
    });

  // Resumen por inspección.
  const statusAt = new Map<string, Status>(); // estado vigente de cada punto al recorrer
  const eventsSum: EventSummary[] = [];
  let prevGood: InspectionEvent | null = null;
  for (const e of evs) {
    const ms = insps.filter((i) => i.date === e.date);
    const criticalOpen = points.filter((p) => statusAt.get(p.point.code) === 'critico').map((p) => p.point.code);
    const riskyNI = points
      .filter((p) => {
        const st = statusAt.get(p.point.code);
        return (st === 'critico' || st === 'alerta') && !ms.some((m) => m.code === p.point.code && m.length != null);
      })
      .map((p) => `${p.point.code} (${STATUS_LABEL[statusAt.get(p.point.code)!]})`);
    const effOf = (code: string) => points.find((x) => x.point.code === code)!.series.find((si) => si.date === e.date);
    const measuredStatuses = ms.filter((m) => m.length != null).map((m) => effOf(m.code)?.effStatus ?? 'ni');
    for (const m of ms) {
      if (m.length == null) continue;
      statusAt.set(m.code, effOf(m.code)?.effStatus ?? 'ni');
    }
    const bad = e.flags.some((f) => f.type === 'horometro' && f.severity === 'error');
    const sinceHours = !bad && prevGood && e.hours != null ? e.hours - prevGood.hours! : null;
    eventsSum.push({
      event: e,
      worst: worst(measuredStatuses),
      measured: ms.filter((m) => m.length != null).length,
      ni: points.length - ms.filter((m) => m.length != null).length,
      repairs: ms.filter((m) => m.repaired).length,
      sinceHours,
      sinceDays: prevGood ? daysBetween(prevGood.date, e.date) : null,
      onTime: sinceHours == null ? null : sinceHours <= s.targetInterval,
      criticalOpen,
      riskyNI,
    });
    if (!bad && e.hours != null) prevGood = e;
  }

  const counts: Record<Status, number> = { ni: 0, sin: 0, normal: 0, alerta: 0, critico: 0 };
  points.forEach((p) => counts[p.status]++);
  const repairs = points.reduce((a, p) => a + p.kpis.repairs, 0);
  const observed = nowHours != null && firstGood ? nowHours - firstGood.hours! : null;
  const mtbf = repairs && observed != null ? observed / repairs : null;
  // Falla (curso, semana 5): pérdida de función. Aquí, cada episodio sobre Danger o con fractura reportada.
  const failures = points.reduce((a, p) => a + p.kpis.dangerEpisodes, 0);
  const mtbfFailure = failures && observed != null ? observed / failures : null;

  // Horas operando con al menos un punto crítico: unión de los episodios (hasta la reparación o el corte).
  const intervals: [number, number][] = [];
  const confirmedIv: [number, number][] = [];
  for (const p of points) {
    let cs: number | null = null;
    let cl = 0;
    for (const si of p.series) {
      if (si.length == null || si.hours == null) continue;
      if (si.effStatus === 'critico') {
        cs ??= si.hours;
        cl = si.hours;
      } else if (cs != null) {
        confirmedIv.push([cs, cl]);
        cs = null;
      }
    }
    if (cs != null) confirmedIv.push([cs, cl]);
    let start: number | null = null;
    for (const si of p.series) {
      if (si.length == null || si.hours == null) continue;
      if (si.effStatus === 'critico') start ??= si.hours;
      else if (start != null) {
        intervals.push([start, si.hours]);
        start = null;
      }
    }
    if (start != null && nowHours != null) intervals.push([start, Math.max(nowHours, start)]);
  }
  const hoursWithCritical = unionLength(intervals);
  const hoursWithCriticalConfirmed = unionLength(confirmedIv);

  const timed = eventsSum.filter((e) => e.onTime != null);
  const onTimeN = timed.filter((e) => e.onTime).length;
  const niCells = eventsSum.reduce((a, e) => a + e.ni, 0);

  const ua: UnitAnalysis = {
    unitId,
    model,
    nowHours,
    nowEstimated,
    nowDate: lastEvent?.date ?? null,
    firstHours: firstGood?.hours ?? null,
    firstDate: evs[0]?.date ?? null,
    usage,
    usageForecast,
    points,
    events: eventsSum,
    counts,
    worst: worst(points.map((p) => p.status)),
    repairs,
    mtbf,
    failures,
    mtbfFailure,
    observedHours: observed,
    hoursWithCritical,
    hoursWithCriticalConfirmed,
    onTimePct: timed.length ? onTimeN / timed.length : null,
    onTimeCount: [onTimeN, timed.length],
    niCells,
    typicalRate,
    medianDays,
    findings: [],
  };
  ua.findings = findingsFor(ua, insps, s);
  return ua;
}

// ---------------------------------------------------------------- hallazgos

function findingsFor(u: UnitAnalysis, insps: Inspection[], s: Settings): Finding[] {
  const out: Finding[] = [];
  const pt = new Map(u.points.map((p) => [p.point.code, p]));

  // 1. Operación sobre Danger.
  for (const p of u.points.filter((x) => x.kpis.dangerEpisodes > 0).sort((a, b) => b.kpis.dangerMax - a.kpis.dangerMax)) {
    const k = p.kpis;
    const conf =
      k.dangerConfirmed > 0
        ? `al menos ${fmtH(k.dangerConfirmed)} h confirmadas (de la primera a la última medida crítica), ${fmtH(k.dangerMax)} h hasta la reparación o el corte y como cota superior ${fmtH(k.dangerUpper)} h (desde la última medida bajo Danger)`
        : `una sola medida sobre Danger; ${fmtH(k.dangerMax)} h hasta registrar la reparación y como cota superior ${fmtH(k.dangerUpper)} h (desde la última medida bajo Danger)`;
    out.push({
      id: `danger-${p.point.code}`,
      severity: p.status === 'critico' ? 'error' : 'warn',
      title: `${p.point.code} operó sobre Danger`,
      text:
        `${p.point.code} (${p.point.description}) operó sobre Danger (${p.point.danger} mm): ${conf}, en ${k.dangerEpisodes} episodio${k.dangerEpisodes > 1 ? 's' : ''}. ` +
        (p.status === 'critico'
          ? `Hoy sigue crítico con ${p.length} mm. El formato indica para Crítico: "reparar antes de continuar operando".`
          : `Hoy está ${p.status === 'sin' ? 'sin grieta' : 'en ' + p.status}. El formato exige reparar antes de continuar operando: no debió seguir en servicio.`),
      points: [p.point.code],
    });
  }

  // 2. Reincidentes (un solo hallazgo).
  const rec = u.points.filter((p) => p.recurrent).sort((a, b) => b.kpis.repairs - a.kpis.repairs);
  if (rec.length) {
    const detail = rec
      .map((p) => `${p.point.code} (${p.kpis.repairs} rep.${p.kpis.reappearMean != null ? `, reaparece a las ${fmtH(p.kpis.reappearMean)} h` : ''})`)
      .join(', ');
    out.push({
      id: 'reincidentes',
      severity: 'warn',
      title: `${rec.length} puntos reincidentes`,
      text: `${detail}. Reparar por soldadura y volver a reparar no elimina la causa: se recomienda análisis de causa raíz (diseño, concentración de esfuerzos, procedimiento de soldadura), refuerzo o cambio de procedimiento. Esto es mantenimiento proactivo.`,
      points: rec.map((p) => p.point.code),
    });
  }
  const rcaOnly = u.points.filter((p) => p.rcaRequired && !p.recurrent);
  if (rcaOnly.length) {
    out.push({
      id: 'acr-danger',
      severity: 'warn',
      title: 'Análisis de causa raíz por falla grave',
      text: `${rcaOnly.map((p) => p.point.code).join(', ')}: aunque ${rcaOnly.length > 1 ? 'tienen' : 'tiene'} menos de 2 reparaciones, ${rcaOnly.length > 1 ? 'operaron' : 'operó'} sobre Danger o se fracturó. Un evento así exige análisis de causa raíz antes de repetir la misma reparación.`,
      points: rcaOnly.map((p) => p.point.code),
    });
  }

  // 3. Inspecciones fuera de intervalo.
  for (const e of u.events.filter((x) => x.event.flags.some((f) => f.type === 'intervalo'))) {
    const crit = e.criticalOpen;
    out.push({
      id: `intervalo-${e.event.date}`,
      severity: crit.length ? 'error' : 'warn',
      title: `Intervalo largo antes del ${fmtD(e.event.date)}`,
      text:
        `${e.sinceDays} días y ${fmtH(e.sinceHours ?? 0)} h desde la inspección anterior (objetivo ≤ ${fmtH(s.targetInterval)} h; mediana ${u.medianDays ?? '—'} días).` +
        (crit.length ? ` Ocurrió con ${crit.join(', ')} en estado Crítico: el intervalo debió acortarse, no alargarse.` : ''),
      points: crit,
    });
  }

  // 4. Inspecciones parciales.
  for (const e of u.events.filter((x) => x.event.flags.some((f) => f.type === 'parcial' && f.severity === 'warn'))) {
    const f = e.event.flags.find((x) => x.type === 'parcial')!;
    out.push({
      id: `parcial-${e.event.date}`,
      severity: 'warn',
      title: `Inspección parcial el ${fmtD(e.event.date)}`,
      text: `${f.message} Un punto N/I no es un punto sano: reprogramar el acceso a las zonas faltantes.`,
      points: [],
    });
  }
  const minorPartial = u.events.filter((x) => x.event.flags.some((f) => f.type === 'parcial' && f.severity === 'info'));
  if (minorPartial.length) {
    out.push({
      id: 'parcial-menores',
      severity: 'info',
      title: `${minorPartial.length} inspecciones con algún punto N/I`,
      text: minorPartial.map((e) => `${fmtD(e.event.date)}: ${e.ni} N/I`).join('; ') + '.',
      points: [],
    });
  }

  const risky = u.events.filter((e) => e.riskyNI.length);
  if (risky.length) {
    out.push({
      id: 'ni-riesgo',
      severity: 'error',
      title: 'Puntos en Alerta o Crítico sin inspeccionar',
      text:
        risky.map((e) => `${fmtD(e.event.date)}: ${e.riskyNI.join(', ')}`).join('; ') +
        '. Un punto con grieta que queda N/I sigue creciendo sin control: debió reprogramarse el acceso o restringirse la operación.',
      points: [...new Set(risky.flatMap((e) => e.riskyNI.map((x) => x.split(' ')[0])))],
    });
  }

  // 5. Crecimiento atípico.
  const jumps = insps.filter((i) => i.flags.some((f) => f.type === 'salto'));
  if (jumps.length) {
    out.push({
      id: 'saltos',
      severity: 'warn',
      title: 'Crecimiento atípico',
      text:
        jumps.map((i) => `${i.code} ${fmtD(i.date)}: ${i.flags.find((f) => f.type === 'salto')!.message.split(':')[1].split('(')[0].trim()}`).join('; ') +
        '. Posible reparación deficiente (defecto remanente) o error de digitación: verificar con END y con el reporte de la reparación.',
      points: [...new Set(jumps.map((i) => i.code))],
    });
  }

  // 6. Bajas sin reparación.
  const drops = insps.filter((i) => i.flags.some((f) => f.type === 'atipico' || f.type === 'baja' || f.type === 'baja-leve'));
  const dropsWarn = drops.filter((i) => i.flags.some((f) => f.type !== 'baja-leve' && f.severity === 'warn'));
  if (drops.length) {
    out.push({
      id: 'bajas',
      severity: dropsWarn.length ? 'warn' : 'info',
      title: 'Medidas que bajan sin reparación',
      text: drops
        .map((i) => {
          const f = i.flags.find((x) => x.type === 'atipico' || x.type === 'baja' || x.type === 'baja-leve')!;
          const tag = f.type === 'atipico' ? 'atípico, excluido' : f.type === 'baja' ? 'verificar' : 'dispersión de medición';
          return `${i.code} ${fmtD(i.date)} = ${i.length} mm (${tag})`;
        })
        .join('; ') + '. Una grieta no se cierra sola: confirme la medida o registre la reparación.',
      points: [...new Set(drops.map((i) => i.code))],
    });
  }

  // 7. Campañas de reparación.
  for (const e of u.events.filter((x) => x.repairs >= 5)) {
    const codes = insps.filter((i) => i.date === e.event.date && i.repaired).map((i) => i.code);
    out.push({
      id: `campana-${e.event.date}`,
      severity: 'info',
      title: `Campaña de reparación el ${fmtD(e.event.date)}`,
      text: `${e.repairs} puntos reparados en una parada (${codes.join(', ')}). Agrupar reparaciones en una parada es buena programación; verifique la calidad de esa intervención si los puntos reaparecen rápido.`,
      points: codes,
    });
  }

  const rank = { error: 0, warn: 1, info: 2 };
  void pt;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------------------------------------------------------------- flota

export const woManHours = (wo: WorkOrder) => wo.operations.reduce((a, o) => a + o.people * o.hours, 0);
export const woDuration = (wo: WorkOrder) => wo.operations.reduce((a, o) => a + o.hours, 0);
export const isOpenWO = (wo: WorkOrder) => wo.state !== 'ejecutada' && wo.state !== 'cerrada';

const cache = new WeakMap<DB, Map<string, FleetAnalysis>>();

export function analyze(db: DB, asOf: string | null = null): FleetAnalysis {
  const key = asOf ?? '';
  let m = cache.get(db);
  if (!m) {
    m = new Map();
    cache.set(db, m);
  }
  const hit = m.get(key);
  if (hit) return hit;

  const lastDate = db.events.map((e) => e.date).sort().slice(-1)[0] ?? null;
  const cut = asOf && lastDate && asOf < lastDate ? asOf : null;
  const events = cut ? db.events.filter((e) => e.date <= cut) : db.events;
  const inspections = cut ? db.inspections.filter((i) => i.date <= cut) : db.inspections;
  const q = runQuality({ points: db.points, events, inspections, settings: db.settings });

  const units = db.units.map((u) =>
    analyzeUnit(u.id, u.model, db, q.events, q.inspections, isFinite(q.typicalRate[u.id]) ? q.typicalRate[u.id] : null, q.medianDays[u.id] ?? null),
  );
  // Con corte, cada OT se muestra en el estado que tenía ese día (según su historia de estados).
  const workOrders = cut
    ? db.workOrders
        .filter((w) => w.createdAt <= cut)
        .map((w) => {
          const h = w.history.filter((x) => x.at.slice(0, 10) <= cut);
          const state = h.length ? h[h.length - 1].state : w.history[0]?.state ?? w.state;
          return state === w.state ? w : { ...w, state };
        })
    : db.workOrders;
  const points = units.flatMap((u) => u.points);
  for (const p of points) p.openWO = workOrders.find((w) => w.pointKey === p.point.key && isOpenWO(w));
  const ranking = points
    .filter((p) => p.hasCrack)
    .sort((a, b) => a.priority.localeCompare(b.priority) || STATUS_RANK[b.status] - STATUS_RANK[a.status] || b.score - a.score || (a.toDanger.pessimistic ?? Infinity) - (b.toDanger.pessimistic ?? Infinity));
  const open = workOrders.filter(isOpenWO);
  const hh = open.reduce((a, w) => a + woManHours(w), 0);
  const res: FleetAnalysis = {
    asOf: cut,
    isPast: !!cut,
    lastDate,
    units,
    points,
    ranking,
    findings: units.flatMap((u) => u.findings.map((f) => (db.units.length > 1 ? { ...f, title: `${u.unitId}: ${f.title}` } : f))),
    inspections: q.inspections,
    events: q.events,
    backlog: {
      open: open.length,
      hh,
      weeks: db.settings.capacity > 0 ? hh / db.settings.capacity : 0,
      p1: open.filter((w) => w.priority === 'P1').length,
      closed: workOrders.filter((w) => w.state === 'cerrada').length,
    },
    workOrders,
    settings: db.settings,
  };
  m.set(key, res);
  return res;
}
