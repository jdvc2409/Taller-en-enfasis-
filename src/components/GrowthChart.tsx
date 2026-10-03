// Gráfica de evolución de una grieta con límites, pronóstico y, con corte en el pasado, lo que pasó después.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointAnalysis, SeriesItem } from '../lib/analysis';
import { STATUS_LABEL } from '../lib/analysis';
import { STATUS_COLOR, fmt, fmtDate } from './ui';

interface Props {
  pa: PointAnalysis; // análisis al corte
  future?: SeriesItem[]; // medidas posteriores al corte (de los datos completos)
  nowHours: number | null;
  nowDate: string | null;
  usage: number | null;
  isPast: boolean;
  height?: number;
}

type Mode = 'horas' | 'fecha';
type Scope = 'todo' | 'ciclo';
const DAY = 86400000;

export function GrowthChart({ pa, future = [], nowHours, nowDate, usage, isPast, height = 400 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  const [mode, setMode] = useState<Mode>('horas');
  const [scope, setScope] = useState<Scope>(isPast ? 'ciclo' : 'todo');
  useEffect(() => setScope(isPast ? 'ciclo' : 'todo'), [isPast]);
  const [hover, setHover] = useState<{ x: number; y: number; s: SeriesItem; after: boolean } | null>(null);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const p = pa.point;
  const fit = pa.fit;
  const now = nowHours ?? pa.lastHours ?? 0;
  const hasForecast = pa.hasCrack && fit.model !== 'sin-datos';

  // Horizonte del pronóstico: hasta un poco después del cruce optimista con Danger (o 1.500 h si no cruza).
  const d = pa.toDanger;
  const horizon = useMemo(() => {
    if (!hasForecast) return 0;
    const ref = d.optimistic ?? d.central ?? d.pessimistic;
    if (ref == null || ref === 0) return pa.status === 'critico' ? 300 : 600;
    return Math.min(Math.max(ref * 1.15, 400), 6000);
  }, [hasForecast, d.optimistic, d.central, d.pessimistic, pa.status]);

  const all = pa.series.filter((s) => s.hours != null);
  // "Ciclo actual": desde la última medida en 0 antes de que apareciera la grieta del ciclo vigente.
  const curCycle = all[all.length - 1]?.cycle ?? 0;
  const inCycle = all.filter((s) => s.cycle === curCycle);
  const firstCrack = inCycle.findIndex((s) => (s.length ?? 0) > 0);
  const shown = scope === 'ciclo' ? (firstCrack > 0 ? inCycle.slice(firstCrack - 1) : inCycle) : all;
  // Con corte, se muestra lo que pasó después solo en una ventana cercana, para no comprimir el pronóstico.
  const futWindow = Math.max(horizon * 2.2, 2200);
  const fut = future.filter((s) => s.hours != null && s.hours <= now + futWindow);

  // Conversión horas ↔ fecha para el eje y para el pronóstico.
  const hToT = (h: number) => (nowDate && usage ? Date.parse(nowDate) + ((h - now) / usage) * DAY : Date.parse(nowDate ?? '2000-01-01'));
  const tOf = (s: SeriesItem) => Date.parse(s.date);
  const X = (s: SeriesItem) => (mode === 'horas' ? s.hours! : tOf(s));
  const Xh = (h: number) => (mode === 'horas' ? h : hToT(h));

  const xs = [...shown.map(X), ...(isPast ? fut.map(X) : []), Xh(now), ...(hasForecast ? [Xh(now + horizon)] : [])];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const pad = (x1 - x0) * 0.02 || 1;
  const maxL = Math.max(...shown.map((s) => s.length ?? 0), ...(isPast ? fut.map((s) => s.length ?? 0) : []), 0);
  const yTop = Math.max(p.danger * 1.25, maxL * 1.08, 10);

  const m = w < 520 ? { l: 46, r: 66, t: 18, b: 52 } : { l: 56, r: 92, t: 18, b: 52 };
  const W = Math.max(w, 320);
  const H = height;
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const sx = (x: number) => m.l + ((x - (x0 - pad)) / (x1 + pad - (x0 - pad))) * iw;
  const sy = (y: number) => m.t + ih - (Math.min(Math.max(y, 0), yTop) / yTop) * ih;

  // Ticks
  const yTicks = niceTicks(0, yTop, 6);
  const xTicks =
    mode === 'horas'
      ? niceTicks(x0, x1, Math.max(3, Math.floor(iw / 110))).map((v) => ({ v, label: fmt(v) }))
      : dateTicks(x0, x1, Math.max(3, Math.floor(iw / 90)));

  // Ciclos (líneas que unen medidas del mismo ciclo, sin contar excluidas)
  const cycles = new Map<number, SeriesItem[]>();
  for (const s of shown) if (s.length != null && !s.excluded) cycles.set(s.cycle, [...(cycles.get(s.cycle) ?? []), s]);
  const futCycles: SeriesItem[][] = [];
  for (const s of fut) {
    if (s.length == null) continue;
    if (s.repaired || !futCycles.length) futCycles.push([]);
    futCycles[futCycles.length - 1].push(s);
  }

  // Pronóstico
  const fc = useMemo(() => {
    if (!hasForecast) return null;
    const steps = 60;
    const pts: { h: number; c: number; u: number; l: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const h = now + (horizon * i) / steps;
      pts.push({ h, c: fit.center(h), u: fit.upper(h), l: Math.max(fit.lower(h), 0) });
    }
    return pts;
  }, [hasForecast, now, horizon, fit]);

  const xNow = sx(Xh(now));
  const dangerStripe =
    hasForecast && pa.status !== 'critico' && (d.pessimistic != null || d.optimistic != null)
      ? { a: sx(Xh(now + (d.pessimistic ?? 0))), b: sx(Xh(now + Math.min(d.optimistic ?? horizon, horizon))) }
      : null;
  const dangerLabel =
    hasForecast && pa.status !== 'critico' && d.central != null
      ? mode === 'horas'
        ? `Danger ≈ ${fmt(now + d.central)} h`
        : `Danger ≈ ${fmtDate(d.date)}`
      : null;
  const repairs = shown.filter((s) => s.repaired);
  const niMarks = pa.series.filter((s) => s.length == null && (scope === 'todo' || (s.cycle === curCycle && (!shown[0] || s.date >= shown[0].date))));
  const hoursForNI = (s: SeriesItem) => (mode === 'horas' ? s.hours ?? null : tOf(s));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best: { dist: number; s: SeriesItem; after: boolean } | null = null;
    for (const s of shown) {
      if (s.length == null) continue;
      const dd = Math.hypot(sx(X(s)) - mx, sy(s.length) - my);
      if (!best || dd < best.dist) best = { dist: dd, s, after: false };
    }
    if (isPast)
      for (const s of fut) {
        if (s.length == null) continue;
        const dd = Math.hypot(sx(X(s)) - mx, sy(s.length) - my);
        if (!best || dd < best.dist) best = { dist: dd, s, after: true };
      }
    setHover(best && best.dist < 26 ? { x: sx(X(best.s)), y: sy(best.s.length!), s: best.s, after: best.after } : null);
  };

  const pathOf = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="row small muted" style={{ gap: 14 }}>
          <Key color="var(--acento)" dash label={hasForecast ? `Pronóstico (${fit.model === 'exponencial' ? 'exponencial' : 'lineal'}) y banda del 90 %` : 'Sin pronóstico'} />
          {isPast && fut.length > 0 && <Key color="var(--apagado)" hollow label="Lo que pasó después del corte" />}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Alcance">
            <button aria-pressed={scope === 'todo'} onClick={() => setScope('todo')}>
              Todo
            </button>
            <button aria-pressed={scope === 'ciclo'} onClick={() => setScope('ciclo')}>
              Ciclo actual
            </button>
          </div>
          <div className="seg" role="group" aria-label="Eje horizontal">
            <button aria-pressed={mode === 'horas'} onClick={() => setMode('horas')}>
              Horas
            </button>
            <button aria-pressed={mode === 'fecha'} onClick={() => setMode('fecha')}>
              Fecha
            </button>
          </div>
        </div>
      </div>
      <div ref={wrap} style={{ position: 'relative' }}>
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`Evolución de ${p.code}: ${pa.length ?? 'N/I'} mm, Caution ${p.caution}, Danger ${p.danger}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ display: 'block', fontFamily: 'var(--fuente)', fontVariantNumeric: 'tabular-nums' }}
        >
          <defs>
            <clipPath id="plot">
              <rect x={m.l} y={m.t} width={iw} height={ih} />
            </clipPath>
          </defs>
          {/* bandas de fondo */}
          <rect x={m.l} y={sy(p.danger)} width={iw} height={sy(p.caution) - sy(p.danger)} fill="var(--alerta)" opacity={0.07} />
          <rect x={m.l} y={m.t} width={iw} height={sy(p.danger) - m.t} fill="var(--critico)" opacity={0.08} />
          {/* rejilla */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--linea)" strokeWidth={1} />
              <text x={m.l - 8} y={sy(t) + 4} fontSize={11.5} textAnchor="end" fill="var(--apagado)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={t.v}>
              <line x1={sx(t.v)} x2={sx(t.v)} y1={m.t + ih} y2={m.t + ih + 5} stroke="var(--linea2)" />
              <text x={sx(t.v)} y={m.t + ih + 19} fontSize={11.5} textAnchor="middle" fill="var(--apagado)">
                {t.label}
              </text>
            </g>
          ))}
          <text x={m.l - 44} y={m.t + ih / 2} fontSize={11.5} fill="var(--apagado)" transform={`rotate(-90 ${m.l - 44} ${m.t + ih / 2})`} textAnchor="middle">
            L (mm)
          </text>
          <text x={m.l + iw / 2} y={H - 6} fontSize={11.5} fill="var(--apagado)" textAnchor="middle">
            {mode === 'horas' ? 'Horómetro (h)' : 'Fecha'}
          </text>
          <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} stroke="var(--linea2)" />

          {/* límites */}
          {[
            { v: p.caution, c: 'var(--alerta)', t: 'Caution' },
            { v: p.danger, c: 'var(--critico)', t: 'Danger' },
          ].map((L) => (
            <g key={L.t}>
              <line x1={m.l} x2={m.l + iw} y1={sy(L.v)} y2={sy(L.v)} stroke={L.c} strokeWidth={1.5} strokeDasharray="6 4" />
              <text x={m.l + iw + 8} y={sy(L.v) - 2} fontSize={12} fontWeight={600} fill={L.c}>
                {L.t}
              </text>
              <text x={m.l + iw + 8} y={sy(L.v) + 12} fontSize={11.5} fill="var(--apagado)">
                {fmt(L.v)} mm
              </text>
            </g>
          ))}

          <g clipPath="url(#plot)">
            {/* reparaciones */}
            {repairs.map((r) => (
              <g key={r.id}>
                <line x1={sx(X(r))} x2={sx(X(r))} y1={m.t} y2={m.t + ih} stroke="var(--acento)" strokeWidth={1.2} strokeDasharray="2 4" opacity={0.8} />
                <text x={sx(X(r)) + 4} y={m.t + 12} fontSize={10.5} fill="var(--acento)">
                  Reparada
                </text>
              </g>
            ))}

            {/* banda y pronóstico */}
            {fc && (
              <>
                <path
                  d={pathOf([...fc.map((q) => [sx(Xh(q.h)), sy(q.u)] as [number, number]), ...[...fc].reverse().map((q) => [sx(Xh(q.h)), sy(q.l)] as [number, number])]) + 'Z'}
                  fill="var(--acento)"
                  opacity={0.14}
                />
                <path d={pathOf(fc.map((q) => [sx(Xh(q.h)), sy(q.c)]))} fill="none" stroke="var(--acento)" strokeWidth={2} strokeDasharray="7 5" />
              </>
            )}
            {dangerStripe && dangerStripe.b > dangerStripe.a && (
              <rect x={dangerStripe.a} y={sy(p.danger) - 3} width={dangerStripe.b - dangerStripe.a} height={6} fill="var(--critico)" rx={2} />
            )}

            {/* lo que pasó después del corte */}
            {isPast &&
              futCycles.map((c, i) => (
                <path key={i} d={pathOf(c.map((s) => [sx(X(s)), sy(s.length!)]))} fill="none" stroke="var(--apagado)" strokeWidth={1.5} opacity={0.7} />
              ))}
            {isPast &&
              fut.map((s) =>
                s.length == null ? null : <circle key={s.id} cx={sx(X(s))} cy={sy(s.length)} r={4.5} fill="var(--sup)" stroke="var(--apagado)" strokeWidth={1.6} />,
              )}

            {/* medidas por ciclo */}
            {[...cycles.values()].map((c, i) => (
              <path key={i} d={pathOf(c.map((s) => [sx(X(s)), sy(s.length!)]))} fill="none" stroke="var(--tinta2)" strokeWidth={1.6} />
            ))}
          </g>

          {/* corte / última inspección */}
          <line x1={xNow} x2={xNow} y1={m.t} y2={m.t + ih} stroke={isPast ? 'var(--acento)' : 'var(--tinta2)'} strokeWidth={isPast ? 2 : 1} />
          <text x={xNow - 5} y={m.t + ih - 8} fontSize={11} textAnchor="end" fill={isPast ? 'var(--acento)' : 'var(--tinta2)'} fontWeight={isPast ? 600 : 400}>
            {isPast ? 'Corte' : 'Última inspección'}
          </text>
          {isPast && fut.length > 0 && (
            <text x={xNow + 6} y={m.t + ih - 8} fontSize={11} fill="var(--apagado)" className="halo">
              Lo que pasó después →
            </text>
          )}
          {dangerLabel && dangerStripe && (
            <text
              x={dangerStripe.b + 120 > m.l + iw ? dangerStripe.a - 6 : dangerStripe.b + 6}
              y={sy(p.danger) + 18}
              fontSize={12}
              fontWeight={600}
              textAnchor={dangerStripe.b + 120 > m.l + iw ? 'end' : 'start'}
              fill="var(--critico)"
              className="halo"
            >
              {dangerLabel}
            </text>
          )}

          {/* puntos medidos */}
          {shown.map((s) => {
            if (s.length == null) return null;
            const cx = sx(X(s));
            const cy = sy(s.length);
            if (s.excluded)
              return (
                <g key={s.id}>
                  <circle cx={cx} cy={cy} r={6} fill="var(--sup)" stroke="var(--tinta2)" strokeWidth={1.4} strokeDasharray="2 2" />
                  <path d={`M${cx - 3},${cy - 3}L${cx + 3},${cy + 3}M${cx + 3},${cy - 3}L${cx - 3},${cy + 3}`} stroke="var(--tinta2)" strokeWidth={1.4} />
                </g>
              );
            if (s.length === 0) return <circle key={s.id} cx={cx} cy={cy} r={4.5} fill="var(--sup)" stroke="var(--sin)" strokeWidth={1.6} />;
            return <circle key={s.id} cx={cx} cy={cy} r={5.5} fill={STATUS_COLOR[s.status]} stroke="var(--sup)" strokeWidth={1.5} />;
          })}

          {/* N/I bajo el eje */}
          {niMarks.map((s) => {
            const v = hoursForNI(s);
            if (v == null || v < x0 - pad || v > x1 + pad) return null;
            return (
              <text key={s.id} x={sx(v)} y={m.t + ih + 34} fontSize={10} textAnchor="middle" fill="var(--apagado)">
                N/I
              </text>
            );
          })}

          {hover && <circle cx={hover.x} cy={hover.y} r={9} fill="none" stroke="var(--tinta)" strokeWidth={1.5} />}
        </svg>
        {hover && <Tip h={hover} W={W} />}
      </div>
    </div>
  );
}

function Tip({ h, W }: { h: { x: number; y: number; s: SeriesItem; after: boolean }; W: number }) {
  const s = h.s;
  const left = h.x + 260 > W ? h.x - 262 : h.x + 14;
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left,
        top: Math.max(h.y - 30, 0),
        width: 248,
        background: 'var(--sup)',
        border: '1px solid var(--linea2)',
        borderRadius: 8,
        padding: '9px 11px',
        fontSize: 13,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {fmtDate(s.date)} · {fmt(s.hours, 1)} h
      </div>
      <div className="tab" style={{ marginTop: 2 }}>
        <b style={{ fontFamily: 'var(--fuente)', fontSize: 18 }}>{s.length} mm</b>{' '}
        <span className="muted">· {s.repaired ? 'Reparada' : STATUS_LABEL[s.status]}</span>
      </div>
      {h.after && <div className="tiny" style={{ color: 'var(--acento)' }}>Medida posterior al corte</div>}
      {s.inspector && <div className="tiny muted">Inspector {s.inspector}</div>}
      {s.comment && <div className="small" style={{ marginTop: 4 }}>"{s.comment}"</div>}
      {s.excluded && <div className="tiny" style={{ marginTop: 4 }}>Excluida de la tendencia</div>}
      {s.flags.map((f, i) => (
        <div key={i} className="tiny" style={{ marginTop: 4, color: f.severity === 'warn' ? 'var(--alerta)' : 'var(--tinta2)' }}>
          {f.message}
        </div>
      ))}
    </div>
  );
}

function Key({ color, dash, hollow, label }: { color: string; dash?: boolean; hollow?: boolean; label: string }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <svg width={24} height={12} aria-hidden="true">
        {hollow ? (
          <circle cx={12} cy={6} r={4} fill="none" stroke={color} strokeWidth={1.6} />
        ) : (
          <>
            <rect x={0} y={2} width={24} height={8} fill={color} opacity={0.15} />
            <line x1={0} x2={24} y1={6} y2={6} stroke={color} strokeWidth={2} strokeDasharray={dash ? '5 3' : undefined} />
          </>
        )}
      </svg>
      {label}
    </span>
  );
}

function niceTicks(a: number, b: number, n: number) {
  const span = b - a || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function dateTicks(a: number, b: number, n: number) {
  const months = (b - a) / (30.44 * DAY);
  const step = [1, 2, 3, 4, 6, 12].find((s) => months / s <= n) ?? 12;
  const d = new Date(a);
  d.setUTCDate(1);
  d.setUTCMonth(Math.ceil(d.getUTCMonth() / step) * step);
  const out: { v: number; label: string }[] = [];
  while (d.getTime() <= b) {
    if (d.getTime() >= a)
      out.push({ v: d.getTime(), label: step >= 12 || d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : `${MES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
    d.setUTCMonth(d.getUTCMonth() + step);
  }
  return out;
}

