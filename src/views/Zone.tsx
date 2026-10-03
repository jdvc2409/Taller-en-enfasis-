import { useState } from 'react';
import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href, navigate } from '../router';
import type { PointAnalysis } from '../lib/analysis';
import { Timeline } from '../components/Timeline';
import { Schematic } from '../components/Schematic';
import { DangerETA } from '../components/Ranking';
import { Icon, LimitBar, Panel, Prio, StatusPill, STATUS_COLOR, fmt } from '../components/ui';

/** Minigráfica de tendencia con la línea Danger. */
export function Sparkline({ p, w = 130, h = 34 }: { p: PointAnalysis; w?: number; h?: number }) {
  const s = p.series.filter((x) => x.length != null && x.hours != null && !x.excluded);
  if (s.length < 2) return <span className="tiny muted">—</span>;
  const h0 = s[0].hours!;
  const h1 = s[s.length - 1].hours!;
  const top = Math.max(p.point.danger * 1.15, ...s.map((x) => x.length!));
  const X = (v: number) => 2 + ((v - h0) / (h1 - h0 || 1)) * (w - 4);
  const Y = (v: number) => h - 2 - (v / top) * (h - 4);
  const segs: string[] = [];
  let cur = '';
  let cyc = -1;
  for (const x of s) {
    if (x.cycle !== cyc) {
      if (cur) segs.push(cur);
      cur = '';
      cyc = x.cycle;
    }
    cur += `${cur ? 'L' : 'M'}${X(x.hours!).toFixed(1)},${Y(x.length!).toFixed(1)}`;
  }
  if (cur) segs.push(cur);
  const last = s[s.length - 1];
  return (
    <svg width={w} height={h} aria-label={`Tendencia de ${p.point.code}`} role="img" style={{ display: 'block' }}>
      <line x1={0} x2={w} y1={Y(p.point.danger)} y2={Y(p.point.danger)} stroke="var(--critico)" strokeDasharray="3 3" strokeWidth={1} />
      <line x1={0} x2={w} y1={Y(p.point.caution)} y2={Y(p.point.caution)} stroke="var(--alerta)" strokeDasharray="2 3" strokeWidth={1} opacity={0.7} />
      {segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--tinta2)" strokeWidth={1.4} />
      ))}
      <circle cx={X(last.hours!)} cy={Y(last.length!)} r={3} fill={STATUS_COLOR[last.status]} />
    </svg>
  );
}

export function ZoneView({ unitId, zoneId }: { unitId: string; zoneId: string }) {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const update = useStore((s) => s.update);
  const [editing, setEditing] = useState(false);
  const zone = db.zones.find((z) => z.id === zoneId);
  const u = fleet.units.find((x) => x.unitId === unitId);
  if (!zone || !u)
    return (
      <div className="panel empty">
        No existe la zona {zoneId} en el equipo {unitId}. <a href={href.flota()}>Volver a la flota</a>.
      </div>
    );
  const pts = u.points.filter((p) => p.point.zone === zone.id);

  const setCrit = (c: number) => update((d) => ({ ...d, zones: d.zones.map((z) => (z.id === zone.id ? { ...z, criticality: c } : z)) }));
  const setReason = (r: string) => update((d) => ({ ...d, zones: d.zones.map((z) => (z.id === zone.id ? { ...z, reason: r } : z)) }));
  const move = (key: string, pos: { x: number; y: number }) =>
    update((d) => ({ ...d, points: d.points.map((p) => (p.key === key ? { ...p, pos2d: pos } : p)) }));
  const startEditing = () => {
    // Los puntos sin ubicación aparecen en una fila abajo para poder arrastrarlos.
    const missing = pts.filter((p) => !p.point.pos2d);
    if (missing.length)
      update((d) => ({
        ...d,
        points: d.points.map((p) => {
          const i = missing.findIndex((m) => m.point.key === p.key);
          return i >= 0 ? { ...p, pos2d: { x: 0.06 + i * 0.09, y: 0.94 } } : p;
        }),
      }));
    setEditing(true);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <a href={href.flota()}>{db.fleet}</a>
            <span>/</span>
            <a href={href.equipo(unitId)}>{unitId}</a>
            <span>/</span>
            <span>{zone.name}</span>
          </div>
          <h1>{zone.name}</h1>
          <p>
            {pts.length} puntos de inspección · consecuencia {zone.criticality}/5
          </p>
        </div>
      </div>

      <Timeline unit={unitId} />

      <div className="grid-main">
        <Panel
          title="Ubicación de los puntos de inspección"
          sub={editing ? 'Arrastre cada punto a la punta de su flecha. La posición se guarda al soltar.' : 'Clic en un punto para abrirlo.'}
          actions={
            !fleet.isPast &&
            (editing ? (
              <button className="btn sm primary" onClick={() => setEditing(false)}>
                Listo
              </button>
            ) : (
              <button className="btn sm" onClick={startEditing}>
                <Icon name="move" size={14} />
                Mover puntos
              </button>
            ))
          }
        >
          <Schematic image={zone.image} points={pts} editing={editing} onMove={move} />
        </Panel>
        <Panel title="Criticidad de la zona" sub="Consecuencia de una falla (C en la matriz de riesgo).">
          <div className="seg" role="group" aria-label="Consecuencia" style={{ marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((c) => (
              <button key={c} aria-pressed={zone.criticality === c} onClick={() => setCrit(c)} disabled={fleet.isPast} style={{ minWidth: 40 }}>
                {c}
              </button>
            ))}
          </div>
          <label className="f">
            Justificación
            <textarea value={zone.reason} onChange={(e) => setReason(e.target.value)} disabled={fleet.isPast} />
          </label>
          {pts.some((p) => p.point.criticality != null) && (
            <div className="notice info small" style={{ marginTop: 12 }}>
              <div>
                Puntos con consecuencia propia:{' '}
                {pts
                  .filter((p) => p.point.criticality != null)
                  .map((p) => `${p.point.code} = ${p.point.criticality} (${p.point.criticalityReason ?? ''})`)
                  .join('; ')}
                . Se editan en Datos → Límites por punto.
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Puntos de la zona" tight>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Punto</th>
                <th>Estado</th>
                <th>L frente a límites</th>
                <th>Tendencia</th>
                <th>Llega a Danger</th>
                <th>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.point.key} className="clickable" onClick={() => navigate(href.punto(p.point.key))}>
                  <td style={{ minWidth: 200 }}>
                    <a className="code" href={href.punto(p.point.key)} onClick={(e) => e.stopPropagation()}>
                      {p.point.code}
                    </a>
                    <div className="small muted">{p.point.description}</div>
                  </td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td style={{ minWidth: 150 }}>
                    <div className="tab small" style={{ marginBottom: 5 }}>
                      <b style={{ fontWeight: 600 }}>{p.length == null ? 'N/I' : `${fmt(p.length)} mm`}</b>
                      <span className="muted">
                        {' '}
                        / {p.point.caution} / {p.point.danger}
                      </span>
                    </div>
                    <LimitBar L={p.length} caution={p.point.caution} danger={p.point.danger} status={p.status} />
                  </td>
                  <td>
                    <Sparkline p={p} />
                  </td>
                  <td>
                    <DangerETA p={p} />
                  </td>
                  <td>{p.hasCrack ? <Prio p={p.priority} title={p.priorityWhy} /> : <span className="muted small">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
