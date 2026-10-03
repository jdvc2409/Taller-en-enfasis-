// Máquina del tiempo: una marca por inspección, coloreada con el peor estado medido ese día.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { analyze, STATUS_RANK, worst } from '../lib/analysis';
import type { Status } from '../types';
import { Icon, STATUS_COLOR, fmtDate } from './ui';

export function Timeline({ unit }: { unit?: string }) {
  const db = useStore((s) => s.db)!;
  const asOf = useStore((s) => s.asOf);
  const setAsOf = useStore((s) => s.setAsOf);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Marcas con todos los datos (no dependen del corte), para ver lo que viene después en tenue.
  const marks = useMemo(() => {
    const full = analyze(db, null);
    const byDate = new Map<string, Status[]>();
    for (const u of full.units) {
      if (unit && u.unitId !== unit) continue;
      for (const e of u.events) byDate.set(e.event.date, [...(byDate.get(e.event.date) ?? []), e.worst]);
    }
    return [...byDate.entries()].map(([date, ss]) => ({ date, worst: worst(ss) })).sort((a, b) => a.date.localeCompare(b.date));
  }, [db, unit]);

  const [open, setOpen] = useState(!!asOf);
  useEffect(() => {
    if (asOf) setOpen(true);
  }, [asOf]);

  if (marks.length < 2) return null;
  const t0 = Date.parse(marks[0].date);
  const t1 = Date.parse(marks[marks.length - 1].date);
  const x = (d: string) => ((Date.parse(d) - t0) / (t1 - t0)) * 100;
  const last = marks[marks.length - 1].date;
  const current = asOf ?? last;
  const idx = Math.max(0, marks.findLastIndex((m) => m.date <= current));
  const years: number[] = [];
  for (let y = new Date(t0).getUTCFullYear() + 1; y <= new Date(t1).getUTCFullYear(); y++) years.push(y);

  const pick = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    const t = t0 + f * (t1 - t0);
    let best = marks[0];
    for (const m of marks) if (Math.abs(Date.parse(m.date) - t) < Math.abs(Date.parse(best.date) - t)) best = m;
    setAsOf(best.date === last ? null : best.date);
  };
  const go = (i: number) => {
    const j = Math.min(Math.max(i, 0), marks.length - 1);
    setAsOf(j === marks.length - 1 ? null : marks[j].date);
  };
  const past = !!asOf;

  return (
    <div className="tm stack" style={{ gap: 10 }}>
      {past && (
        <div className="notice info" role="status">
          <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
            <span>
              Estás viendo el <b>{fmtDate(asOf)}</b>. Lo que se midió después aparece en gris.
            </span>
            <button className="btn sm" onClick={() => setAsOf(null)}>
              Volver a hoy
            </button>
          </div>
        </div>
      )}
      <details className="panel tm-box" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="tm-summary">
          <span>Ver el estado en otra fecha</span>
          <span className="small muted">
            {past ? `Fecha elegida: ${fmtDate(asOf)}` : `Hoy: última inspección del ${fmtDate(last)}`}
          </span>
        </summary>
        <div className="tm-body">
      <div className="tm-top">
        <div className="tm-title">
          <span className="small muted">
            Elija una inspección para ver la plataforma como estaba ese día. Use las flechas o arrastre sobre la franja.
          </span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm icon" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Inspección anterior" title="Inspección anterior">
            <Icon name="left" />
          </button>
          <span className="small muted tab" style={{ minWidth: 54, textAlign: 'center' }}>
            {idx + 1} / {marks.length}
          </span>
          <button className="btn sm icon" onClick={() => go(idx + 1)} disabled={idx === marks.length - 1} aria-label="Inspección siguiente" title="Inspección siguiente">
            <Icon name="right" />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className="tm-track"
        role="slider"
        tabIndex={0}
        aria-label="Fecha de corte"
        aria-valuemin={0}
        aria-valuemax={marks.length - 1}
        aria-valuenow={idx}
        aria-valuetext={fmtDate(current)}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pick(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && pick(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(idx - 1);
          else if (e.key === 'ArrowRight') go(idx + 1);
          else if (e.key === 'End') go(marks.length - 1);
          else if (e.key === 'Home') go(0);
          else return;
          e.preventDefault();
        }}
      >
        <div className="tm-axis" />
        {marks.map((m) => (
          <div
            key={m.date}
            className={`tm-mark${m.date > current ? ' future' : ''}`}
            style={{
              left: `${x(m.date)}%`,
              background: STATUS_COLOR[m.worst],
              height: STATUS_RANK[m.worst] >= 3 ? 18 : 14,
              top: STATUS_RANK[m.worst] >= 3 ? 8 : 10,
            }}
            title={`${fmtDate(m.date)}`}
          />
        ))}
        <div className="tm-handle" style={{ left: `${x(marks[idx].date)}%` }} />
        <div className="tm-years" aria-hidden="true">
          {years.map((y) => {
            const p = ((Date.UTC(y, 0, 1) - t0) / (t1 - t0)) * 100;
            return (
              <span key={y} style={{ left: `${p}%` }}>
                {y}
              </span>
            );
          })}
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}
