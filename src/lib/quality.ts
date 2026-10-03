// Revisión de calidad de datos: marca cada registro y decide qué medidas se excluyen de la tendencia.
// "Los datos vienen de campo: revísenlos antes de confiar en ellos."
import type { Flag, Inspection, InspectionEvent, Point, Settings } from '../types';

export const DAY_MS = 86400000;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const fmt = (n: number, d = 0) => n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d });

export interface QualityInput {
  points: Point[];
  events: InspectionEvent[];
  inspections: Inspection[];
  settings: Settings;
}

export interface QualityResult {
  events: InspectionEvent[];
  inspections: Inspection[];
  /** Ritmo típico de crecimiento por equipo (mediana, mm por cada 100 h). */
  typicalRate: Record<string, number>;
  /** Mediana de días entre inspecciones por equipo. */
  medianDays: Record<string, number>;
}

/** Ritmo de crecimiento (mm/100 h) entre medidas consecutivas con grieta (> 0) del mismo ciclo que crecen, sin errores de horómetro. */
export function growthPairs(seq: { length: number | null; repaired: boolean; hours: number | null; skip: boolean }[]) {
  const out: number[] = [];
  let prev: { L: number; h: number } | null = null;
  for (const m of seq) {
    if (m.repaired) {
      prev = null;
      continue;
    }
    if (m.length == null || m.skip || m.hours == null) continue;
    if (m.length > 0 && prev && prev.L > 0 && m.length > prev.L && m.hours > prev.h) {
      out.push(((m.length - prev.L) / (m.hours - prev.h)) * 100);
    }
    prev = { L: m.length, h: m.hours };
  }
  return out;
}

export function runQuality(input: QualityInput): QualityResult {
  const { settings } = input;
  const events = input.events.map((e) => ({ ...e, flags: [] as Flag[] }));
  const inspections = input.inspections.map((i) => ({ ...i, flags: [] as Flag[], excluded: false }));
  const evById = new Map(events.map((e) => [e.id, e]));
  const typicalRate: Record<string, number> = {};
  const medianDays: Record<string, number> = {};
  const badEvents = new Set<string>();

  const units = [...new Set(events.map((e) => e.unit))];
  for (const unit of units) {
    const evs = events.filter((e) => e.unit === unit).sort((a, b) => a.date.localeCompare(b.date));
    const unitPoints = input.points.filter((p) => p.unit === unit);
    const gaps = evs.slice(1).map((e, i) => daysBetween(evs[i].date, e.date));
    medianDays[unit] = median(gaps);

    // Encabezado: horómetro, intervalo y parcial.
    let prev: InspectionEvent | null = null;
    for (const e of evs) {
      if (e.hours == null) {
        e.flags.push({ type: 'horometro', severity: 'warn', message: 'Inspección sin horómetro: sus medidas no entran al pronóstico.' });
      } else if (prev && prev.hours != null) {
        const d = Math.max(daysBetween(prev.date, e.date), 0);
        const dh = e.hours - prev.hours;
        if (dh < 0) {
          e.flags.push({
            type: 'horometro',
            severity: 'error',
            message: `El horómetro retrocede ${fmt(-dh, 1)} h frente a la inspección del ${prev.date}. Corrija las horas; mientras tanto sus medidas se excluyen.`,
          });
        } else if (d > 0 && dh / d > 24) {
          e.flags.push({
            type: 'horometro',
            severity: 'error',
            message: `${fmt(dh, 1)} h en ${d} días (${fmt(dh / d, 1)} h/día) supera 24 h/día. Corrija las horas; mientras tanto sus medidas se excluyen.`,
          });
        } else if (dh > 1.5 * settings.targetInterval || (gaps.length && d > 2 * medianDays[unit])) {
          e.flags.push({
            type: 'intervalo',
            severity: 'warn',
            message: `Intervalo largo: ${d} días y ${fmt(dh)} h desde la inspección anterior (objetivo ≤ ${fmt(settings.targetInterval)} h; mediana ${fmt(medianDays[unit])} días).`,
          });
        }
      }
      if (e.flags.some((f) => f.type === 'horometro' && f.severity === 'error')) badEvents.add(e.id);
      else if (e.hours != null) prev = e;

      const ni = unitPoints.filter((p) => {
        const m = inspections.find((i) => i.unit === unit && i.code === p.code && i.date === e.date);
        return !m || m.length == null;
      });
      if (ni.length) {
        const half = ni.length >= unitPoints.length / 2;
        e.flags.push({
          type: 'parcial',
          severity: half ? 'warn' : 'info',
          message: `Inspección parcial: ${ni.length} de ${unitPoints.length} puntos N/I (${ni.map((p) => p.code).join(', ')}).`,
        });
      }
    }

    // Marcas por medida. Se recorre dos veces: la primera solo identifica atípicos, que no deben
    // sesgar el ritmo típico; la segunda marca todo con el umbral de "salto" ya calculado.
    const unitInsp = inspections.filter((i) => i.unit === unit);
    flagMeasures(unitInsp, unitPoints, evById, badEvents, Infinity);
    const atypical = new Set(unitInsp.filter((i) => i.flags.some((f) => f.type === 'atipico')).map((i) => i.id));
    unitInsp.forEach((i) => {
      i.flags = [];
      i.excluded = false;
    });

    // Ritmo típico del equipo (para "salto" y para proyectar con una sola medida).
    const rates: number[] = [];
    for (const p of unitPoints) {
      const seq = inspections
        .filter((i) => i.unit === unit && i.code === p.code)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((i) => ({
          length: i.length,
          repaired: i.repaired,
          hours: evById.get(`${unit}|${i.date}`)?.hours ?? null,
          skip: badEvents.has(`${unit}|${i.date}`) || atypical.has(i.id),
        }));
      rates.push(...growthPairs(seq));
    }
    typicalRate[unit] = rates.length ? median(rates) : NaN;
    const jumpLimit = Math.max(100, 4 * (isFinite(typicalRate[unit]) ? typicalRate[unit] : 0));
    flagMeasures(unitInsp, unitPoints, evById, badEvents, jumpLimit);
  }

  // La decisión manual del usuario prevalece.
  for (const m of inspections) {
    if (m.override === 'include') m.excluded = false;
    else if (m.override === 'exclude') m.excluded = true;
  }
  return { events, inspections, typicalRate, medianDays };
}

function flagMeasures(
  unitInsp: Inspection[],
  unitPoints: Point[],
  evById: Map<string, InspectionEvent>,
  badEvents: Set<string>,
  jumpLimit: number,
) {
  {
    for (const p of unitPoints) {
      const unit = p.unit;
      const seq = unitInsp.filter((i) => i.code === p.code).sort((a, b) => a.date.localeCompare(b.date));
      let last: { L: number; h: number | null; date: string } | null = null;
      for (let k = 0; k < seq.length; k++) {
        const m = seq[k];
        const evId = `${unit}|${m.date}`;
        if (badEvents.has(evId)) {
          m.excluded = true;
          continue;
        }
        if (m.length == null) continue;
        const h = evById.get(evId)?.hours ?? null;
        if (m.repaired) {
          if (last && last.L === 0) {
            m.flags.push({
              type: 'repara-sin-grieta',
              severity: 'info',
              message: `Reparación registrada cuando la medida anterior (${last.date}) era 0 mm: verifique si hubo grieta o si es un error de registro.`,
            });
          }
          last = { L: 0, h, date: m.date };
          continue;
        }
        if (last && m.length < last.L) {
          const drop = (last.L - m.length) / last.L;
          const next = seq.slice(k + 1).find((n) => n.length != null && !badEvents.has(`${unit}|${n.date}`));
          if (drop > 0.3 && next && !next.repaired && next.length! >= 0.9 * last.L) {
            m.flags.push({
              type: 'atipico',
              severity: 'warn',
              message: `Valor atípico: ${fmt(m.length)} mm entre ${fmt(last.L)} mm (${last.date}) y ${fmt(next.length!)} mm (${next.date}) sin reparación. Probable error de medición o digitación; se excluye del pronóstico.`,
            });
            m.excluded = true;
            continue; // no actualiza la última medida confiable
          }
          if (drop <= 0.15 && m.length > 0) {
            m.flags.push({
              type: 'baja-leve',
              severity: 'info',
              message: `Baja de ${fmt(last.L)} a ${fmt(m.length)} mm (${fmt(drop * 100)} %) sin reparación: dentro de la dispersión normal de la medición.`,
            });
          } else {
            m.flags.push({
              type: 'baja',
              severity: 'warn',
              message:
                m.length === 0
                  ? `La grieta pasa de ${fmt(last.L)} mm a 0 sin comentario de reparación. Confirme si se reparó (y regístrelo) o si fue un error.`
                  : `Baja de ${fmt(last.L)} a ${fmt(m.length)} mm (${fmt(drop * 100)} %) sin reparación registrada. Verifique la medida en campo.`,
            });
          }
        } else if (last && last.h != null && h != null && h > last.h && m.length > last.L) {
          const rate = ((m.length - last.L) / (h - last.h)) * 100;
          if (rate > jumpLimit) {
            m.flags.push({
              type: 'salto',
              severity: 'warn',
              message: `Crecimiento atípico: de ${fmt(last.L)} a ${fmt(m.length)} mm en ${fmt(h - last.h)} h (${fmt(rate)} mm/100 h; límite ${fmt(jumpLimit)}). Posible reparación deficiente o error de digitación. Se mantiene en la tendencia.`,
            });
          }
        }
        last = { L: m.length, h, date: m.date };
      }
    }
  }
}
