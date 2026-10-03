// Lectura y escritura del Excel de historial. Reconoce columnas por nombre (sin importar mayúsculas,
// tildes ni orden) y acepta fechas como fecha de Excel, número serial o texto dd/mm/aaaa o aaaa-mm-dd.
import * as XLSX from 'xlsx';
import type { DB, Inspection, InspectionEvent, Point, Unit, Zone } from '../types';
import { DEFAULT_SETTINGS, POINT_CRITICALITY, POS2D, ZONE_DEFAULTS } from './catalog';

export interface ParsedWorkbook {
  fleet: string;
  units: Unit[];
  zones: Zone[];
  points: Point[];
  events: InspectionEvent[];
  inspections: Inspection[];
  warnings: string[];
}

export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Convierte cualquier representación de fecha a aaaa-mm-dd. */
export function toISODate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // SheetJS puede entregar medianoche local o UTC con segundos de deriva: +12 h y componentes locales.
    const t = new Date(v.getTime() + 12 * 3600 * 1000);
    return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    return p ? ymd(p.y, p.m, p.d) : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  if (/^\d+(\.\d+)?$/.test(s)) return toISODate(Number(s));
  return null;
}

/** Número con punto o coma decimal; vacío → null. */
export function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // el último separador es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot && /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const str = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Una reparación es L = 0 con un comentario que afirma la reparación ("reparada", "soldada"...).
 * No cuenta si el texto la pide o la niega ("no debe operar hasta reparar", "sin reparar", "pendiente").
 */
export const isRepairComment = (c: string) =>
  /reparad[oa]s?|soldad[oa]s?|reconstruid[oa]|reemplazad[oa]|se repar[oó]|se sold[oó]/i.test(c) &&
  !/(hasta|sin|por|pendientes?|falta)\s+(de\s+)?repar|\bno\s+(se\s+)?(ha\s+)?(repar|sold)/i.test(c);

/** Comentario que indica fractura o grieta pasante: el punto es Crítico sin importar L. */
export const isFractureComment = (c: string) => /fractur|pasante|no debe operar|fuera de servicio|rotura|roto\b/i.test(c);

type ColSpec = Record<string, (h: string) => boolean>;

const HIST_COLS: ColSpec = {
  fecha: (h) => h.startsWith('fecha'),
  equipo: (h) => h.startsWith('equipo') || h.startsWith('unidad') || h === 'maquina',
  horas: (h) => h.startsWith('horas') || h.startsWith('horometro') || h === 'h' || h === 'hrs',
  inspector: (h) => h.startsWith('inspector'),
  zona: (h) => h.startsWith('zona'),
  codigo: (h) => h.startsWith('codigo') || h === 'punto' || h.startsWith('codpunto'),
  descripcion: (h) => h.startsWith('descripcion'),
  largo: (h) =>
    !h.includes('anterior') && (h.startsWith('lactual') || h === 'l' || h === 'lmm' || h.startsWith('longitud')),
  comentario: (h) => h.startsWith('comentario') || h.startsWith('observacion'),
  imagen: (h) => h.startsWith('imagen') || h.startsWith('foto'),
};

const POINT_COLS: ColSpec = {
  codigo: HIST_COLS.codigo,
  zona: HIST_COLS.zona,
  descripcion: HIST_COLS.descripcion,
  caution: (h) => h.startsWith('caution'),
  danger: (h) => h.startsWith('danger'),
  esquema: (h) => h.startsWith('esquema') || h.startsWith('imagen'),
};

/** Busca la fila de encabezado (en las 15 primeras) que contenga las columnas requeridas. */
function findHeader(rows: unknown[][], spec: ColSpec, required: string[]) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cols: Record<string, number> = {};
    (rows[r] || []).forEach((cell, i) => {
      const h = norm(cell);
      if (!h) return;
      for (const [k, test] of Object.entries(spec)) if (cols[k] == null && test(h)) cols[k] = i;
    });
    if (required.every((k) => cols[k] != null)) return { row: r, cols };
  }
  return null;
}

/** Id corto de zona: prefijo común de los códigos (AP-01 → AP) o, si no hay, el nombre normalizado. */
function zoneIdFrom(name: string, codes: string[]) {
  const prefixes = new Set(codes.map((c) => c.split(/[-_ ]/)[0].toUpperCase()));
  if (prefixes.size === 1) return [...prefixes][0];
  return norm(name).slice(0, 12).toUpperCase() || 'ZONA';
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array): ParsedWorkbook {
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const warnings: string[] = [];
  const sheetRows = (name: string) =>
    XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null });

  // Hoja de historial: por nombre o la primera con encabezado válido.
  const required = ['fecha', 'codigo', 'largo'];
  let histName = wb.SheetNames.find((n) => norm(n).includes('historial'));
  let hist = histName ? findHeader(sheetRows(histName), HIST_COLS, required) : null;
  if (!hist) {
    for (const n of wb.SheetNames) {
      const h = findHeader(sheetRows(n), HIST_COLS, required);
      if (h) {
        histName = n;
        hist = h;
        break;
      }
    }
  }
  if (!hist || !histName) {
    throw new Error(
      'No encontré una hoja con las columnas Fecha, Código y L actual (mm). Revise que el Excel tenga una fila de encabezado con esos nombres.',
    );
  }

  // Léame: pares clave/valor.
  let fleet = '';
  let readmeUnit = '';
  const readme = wb.SheetNames.find((n) => /leame|readme/.test(norm(n)));
  if (readme) {
    for (const r of sheetRows(readme)) {
      const k = norm(r?.[0]);
      if (k === 'flota') fleet = str(r[1]);
      if (k === 'equipo') readmeUnit = str(r[1]);
    }
  }

  // Puntos (si existe la hoja).
  const pointsByCode = new Map<string, { zona: string; descripcion: string; caution: number; danger: number; esquema: string }>();
  const ptName = wb.SheetNames.find((n) => norm(n).includes('punto'));
  if (ptName) {
    const rows = sheetRows(ptName);
    const ph = findHeader(rows, POINT_COLS, ['codigo', 'caution', 'danger']);
    if (ph) {
      for (const r of rows.slice(ph.row + 1)) {
        const code = str(r[ph.cols.codigo]).toUpperCase();
        const c = toNumber(r[ph.cols.caution]);
        const d = toNumber(r[ph.cols.danger]);
        if (!code) continue;
        if (c == null || d == null || !(d > c) || c <= 0) {
          warnings.push(`Puntos: ${code} tiene límites inválidos (Caution ${c ?? 'vacío'}, Danger ${d ?? 'vacío'}); revíselos en Datos.`);
        }
        pointsByCode.set(code, {
          zona: ph.cols.zona != null ? str(r[ph.cols.zona]) : '',
          descripcion: ph.cols.descripcion != null ? str(r[ph.cols.descripcion]) : '',
          caution: c ?? 0,
          danger: d ?? 0,
          esquema: ph.cols.esquema != null ? str(r[ph.cols.esquema]) : '',
        });
      }
    }
  } else {
    warnings.push('No hay hoja Puntos: los límites Caution y Danger quedan en 0 y deben definirse en Datos.');
  }

  // Historial.
  const rows = sheetRows(histName);
  const c = hist.cols;
  const inspections: Inspection[] = [];
  const eventsMap = new Map<string, { unit: string; date: string; hours: number[]; inspectors: string[] }>();
  const zoneOfCode = new Map<string, string>();
  const descOfCode = new Map<string, string>();
  const imageOfZone = new Map<string, string>();
  const seen = new Set<string>();
  for (let i = hist.row + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const excelRow = i + 1;
    const date = toISODate(r[c.fecha]);
    const code = str(r[c.codigo]).toUpperCase();
    if (!date && !code) continue; // fila vacía
    if (!date || !code) {
      warnings.push(`Fila ${excelRow}: sin ${!date ? 'fecha válida' : 'código de punto'}; se omitió.`);
      continue;
    }
    const unit = (c.equipo != null ? str(r[c.equipo]) : '') || readmeUnit || 'EQUIPO-1';
    const id = `${unit}|${code}|${date}`;
    if (seen.has(id)) {
      warnings.push(`Fila ${excelRow}: ${code} ${date} está repetido; se conservó el primero.`);
      continue;
    }
    seen.add(id);
    const rawL = r[c.largo];
    const length = toNumber(rawL);
    if (rawL != null && rawL !== '' && length == null) {
      warnings.push(`Fila ${excelRow}: L actual "${String(rawL)}" no es un número; se tomó como N/I.`);
    }
    if (length != null && length < 0) {
      warnings.push(`Fila ${excelRow}: L actual negativa (${length}); se tomó como N/I.`);
    }
    const comment = c.comentario != null ? str(r[c.comentario]) : '';
    const L = length != null && length >= 0 ? length : null;
    const zona = c.zona != null ? str(r[c.zona]) : '';
    if (zona && !zoneOfCode.has(code)) zoneOfCode.set(code, zona);
    const desc = c.descripcion != null ? str(r[c.descripcion]) : '';
    if (desc && !descOfCode.has(code)) descOfCode.set(code, desc);
    const image = c.imagen != null ? str(r[c.imagen]) : '';
    inspections.push({
      id,
      unit,
      code,
      date,
      length: L,
      repaired: L === 0 && isRepairComment(comment),
      comment,
      image,
      photos: image && /\.(jpe?g|webp|heic)$/i.test(image) ? [image] : [],
      excluded: false,
      flags: [],
      row: excelRow,
      source: 'excel',
    });
    const evId = `${unit}|${date}`;
    const ev = eventsMap.get(evId) ?? { unit, date, hours: [], inspectors: [] };
    const h = c.horas != null ? toNumber(r[c.horas]) : null;
    if (h != null) ev.hours.push(h);
    const insp = c.inspector != null ? str(r[c.inspector]) : '';
    if (insp) ev.inspectors.push(insp);
    eventsMap.set(evId, ev);
  }

  // Encabezados de inspección: horómetro e inspector más frecuentes del día.
  const mode = <T>(xs: T[]): T | undefined => {
    const cnt = new Map<T, number>();
    xs.forEach((x) => cnt.set(x, (cnt.get(x) ?? 0) + 1));
    return [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const events: InspectionEvent[] = [...eventsMap.entries()].map(([id, e]) => {
    if (new Set(e.hours).size > 1) {
      warnings.push(`${e.unit} ${e.date}: hay horómetros distintos el mismo día; se tomó ${mode(e.hours)} h.`);
    }
    return {
      id,
      unit: e.unit,
      date: e.date,
      hours: mode(e.hours) ?? null,
      inspector: mode(e.inspectors) ?? '',
      notes: '',
      zoneNotes: {},
      flags: [],
      source: 'excel',
    };
  });

  // Puntos y zonas.
  const units = [...new Set(inspections.map((i) => i.unit))];
  const codes = [...new Set([...pointsByCode.keys(), ...inspections.map((i) => i.code)])];
  const zoneNameOf = (code: string) => pointsByCode.get(code)?.zona || zoneOfCode.get(code) || 'Sin zona';
  const zoneNames = [...new Set(codes.map(zoneNameOf))];
  const zones: Zone[] = zoneNames.map((name, i) => {
    const zcodes = codes.filter((cd) => zoneNameOf(cd) === name);
    const id = zoneIdFrom(name, zcodes);
    const def = ZONE_DEFAULTS[id];
    const image = zcodes.map((cd) => pointsByCode.get(cd)?.esquema).find(Boolean) ?? '';
    imageOfZone.set(name, image);
    return {
      id,
      name,
      criticality: def?.criticality ?? 3,
      reason: def?.reason ?? 'Sin justificación: defina la consecuencia de falla de esta zona.',
      image,
      order: def?.order ?? 10 + i,
    };
  });
  const zoneIdOf = (code: string) => zones.find((z) => z.name === zoneNameOf(code))!.id;

  const points: Point[] = [];
  for (const unit of units) {
    for (const code of codes) {
      const p = pointsByCode.get(code);
      if (!p) warnings.push(`${code} aparece en el historial pero no en la hoja Puntos: defina sus límites en Datos.`);
      points.push({
        key: `${unit}|${code}`,
        unit,
        code,
        zone: zoneIdOf(code),
        description: p?.descripcion || descOfCode.get(code) || '',
        caution: p?.caution ?? 0,
        danger: p?.danger ?? 0,
        pos2d: POS2D[code],
        criticality: POINT_CRITICALITY[code]?.criticality,
        criticalityReason: POINT_CRITICALITY[code]?.reason,
      });
    }
  }

  // Si una zona no tiene esquema en Puntos, tomar la imagen de esquema usada en el historial.
  for (const z of zones) {
    if (z.image) continue;
    const img = inspections.find((i) => zoneIdOf(i.code) === z.id && /\.png$/i.test(i.image))?.image;
    if (img) z.image = img;
  }

  const model = /631g/i.test(fleet) ? 'CAT 631G' : fleet;
  return {
    fleet: fleet || 'Flota',
    units: units.map((id) => ({ id, fleet: fleet || 'Flota', model })),
    zones: zones.sort((a, b) => a.order - b.order),
    points,
    events: events.sort((a, b) => a.date.localeCompare(b.date)),
    inspections,
    warnings,
  };
}

export function emptyDB(): DB {
  return {
    version: 1,
    fleet: '',
    units: [],
    zones: [],
    points: [],
    events: [],
    inspections: [],
    workOrders: [],
    settings: { ...DEFAULT_SETTINGS },
    imports: [],
    images: [],
    pos3d: {},
  };
}

/** Une un Excel leído con la base actual. "agregar" no duplica punto + fecha; "reemplazar" borra el historial. */
export function mergeImport(db: DB, p: ParsedWorkbook, mode: 'agregar' | 'reemplazar') {
  const base: DB =
    mode === 'reemplazar'
      ? { ...emptyDB(), settings: db.settings, images: db.images, pos3d: db.pos3d, imports: db.imports }
      : db;
  const byKey = <T,>(xs: T[], k: (x: T) => string) => new Map(xs.map((x) => [k(x), x]));

  const units = byKey(base.units, (u) => u.id);
  p.units.forEach((u) => !units.has(u.id) && units.set(u.id, u));
  const zones = byKey(base.zones, (z) => z.id);
  p.zones.forEach((z) => !zones.has(z.id) && zones.set(z.id, z));
  const points = byKey(base.points, (x) => x.key);
  p.points.forEach((x) => !points.has(x.key) && points.set(x.key, x));
  const events = byKey(base.events, (e) => e.id);
  p.events.forEach((e) => {
    const cur = events.get(e.id);
    if (!cur) events.set(e.id, e);
    else if (cur.hours == null && e.hours != null) events.set(e.id, { ...cur, hours: e.hours });
  });
  const insp = byKey(base.inspections, (i) => i.id);
  let added = 0;
  let skipped = 0;
  for (const i of p.inspections) {
    if (insp.has(i.id)) skipped++;
    else {
      insp.set(i.id, i);
      added++;
    }
  }
  const next: DB = {
    ...base,
    fleet: base.fleet || p.fleet,
    units: [...units.values()],
    zones: [...zones.values()].sort((a, b) => a.order - b.order),
    points: [...points.values()],
    events: [...events.values()].sort((a, b) => a.date.localeCompare(b.date)),
    inspections: [...insp.values()],
  };
  return { db: next, added, skipped };
}

/** Exporta el historial con el mismo formato del Excel de entrada (Léame, Historial, Puntos). */
export function exportWorkbook(db: DB): Uint8Array {
  const wb = XLSX.utils.book_new();
  const dates = db.events.map((e) => e.date).sort();
  const readme: unknown[][] = [
    ['HISTORIAL DE GRIETAS – INSPECCIÓN ESTRUCTURAL'],
    ['Exportado desde la plataforma Integridad Estructural'],
    [],
    ['Flota', db.fleet],
    ['Equipo', db.units.map((u) => u.id).join(', ')],
    ['Periodo', dates.length ? `${dates[0]} a ${dates[dates.length - 1]}` : ''],
    ['Inspecciones', db.events.length],
    ['Zonas', `${db.zones.length} zonas, ${db.points.length} puntos de inspección (ver hoja Puntos)`],
    [],
    ['Cómo leer los datos'],
    ['L actual (mm)', 'Longitud de grieta medida en la inspección. 0 = sin grieta detectable.'],
    ['Celda vacía', 'Punto no inspeccionado en esa fecha (acceso, limpieza, programación).'],
    ['Criterio de estado', 'Normal: L < Caution  |  Alerta: Caution ≤ L < Danger  |  Crítico: L ≥ Danger'],
    ['Horas', 'Horas de operación acumuladas del equipo (horómetro) en la fecha de inspección.'],
    ['Comentario', 'Observación del inspector. Una reparación se registra como L = 0 con "Zona reparada por soldadura".'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), 'Léame');

  const zoneName = new Map(db.zones.map((z) => [z.id, z.name]));
  const pointOf = new Map(db.points.map((p) => [p.key, p]));
  const evOf = new Map(db.events.map((e) => [e.id, e]));
  const rows = [...db.inspections]
    .sort((a, b) => a.date.localeCompare(b.date) || a.unit.localeCompare(b.unit) || a.code.localeCompare(b.code))
    .map((i) => {
      const p = pointOf.get(`${i.unit}|${i.code}`);
      const e = evOf.get(`${i.unit}|${i.date}`);
      const [y, m, d] = i.date.split('-').map(Number);
      return [
        new Date(y, m - 1, d, 12),
        i.unit,
        e?.hours ?? null,
        e?.inspector ?? '',
        zoneName.get(p?.zone ?? '') ?? '',
        i.code,
        p?.description ?? '',
        i.length,
        i.comment,
        i.photos[0] ?? i.image,
      ];
    });
  const hist = XLSX.utils.aoa_to_sheet(
    [['Fecha', 'Equipo', 'Horas (h)', 'Inspector', 'Zona', 'Código', 'Descripción', 'L actual (mm)', 'Comentario', 'Imagen'], ...rows],
    { cellDates: true, dateNF: 'yyyy-mm-dd' },
  );
  XLSX.utils.book_append_sheet(wb, hist, 'Historial');

  const seen = new Set<string>();
  const pts = db.points
    .filter((p) => !seen.has(p.code) && seen.add(p.code))
    .map((p) => {
      const z = db.zones.find((x) => x.id === p.zone);
      return [p.code, z?.name ?? '', p.description, p.caution, p.danger, z?.image ?? ''];
    });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Código', 'Zona', 'Descripción', 'Caution (mm)', 'Danger (mm)', 'Esquema'], ...pts]),
    'Puntos',
  );
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}
