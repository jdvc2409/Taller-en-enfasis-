// "Qué atender primero": puntos con grieta activa ordenados por prioridad.
import type { FleetAnalysis, PointAnalysis } from '../lib/analysis';
import { fmtH } from '../lib/analysis';
import { createWorkOrder } from '../lib/ot';
import { href, navigate } from '../router';
import { useStore } from '../store';
import { LimitBar, Prio, StatusPill, fmt, fmtDate } from './ui';
import { Term } from './Help';

export function DangerETA({ p, compact }: { p: PointAnalysis; compact?: boolean }) {
  const d = p.toDanger;
  if (p.status === 'critico') return <span style={{ color: 'var(--critico)', fontWeight: 600 }}>Ya superado</span>;
  if (!p.hasCrack) return <span className="muted">—</span>;
  if (d.pessimistic == null && d.central == null) return <span className="muted">Más de 15.000 h</span>;
  if (d.pessimistic === 0) return <span style={{ color: 'var(--critico)', fontWeight: 600 }}>Posible ya (pesimista)</span>;
  return (
    <span className="tab" style={{ whiteSpace: 'nowrap' }}>
      <b style={{ fontWeight: 600 }}>
        {fmtH(d.pessimistic ?? 0)}
        {d.central != null && <> – {fmtH(d.central)}</>} h
      </b>
      {!compact && d.datePess && <div className="tiny muted">desde {fmtDate(d.datePess)}</div>}
    </span>
  );
}

export function useCreateWO() {
  const update = useStore((s) => s.update);
  return (fleet: FleetAnalysis, p: PointAnalysis) => {
    const unit = fleet.units.find((u) => u.unitId === p.point.unit)!;
    let id = '';
    update((db) => {
      const wo = createWorkOrder(db, p, unit);
      id = wo.id;
      return { ...db, workOrders: [...db.workOrders, wo] };
    });
    navigate(href.ot(id));
  };
}

export function Ranking({ fleet, rows }: { fleet: FleetAnalysis; rows: PointAnalysis[] }) {
  const createWO = useCreateWO();
  if (!rows.length)
    return (
      <div className="empty">
        Ningún punto tiene grieta activa{fleet.isPast ? ' en esta fecha' : ''}. Siga con la inspección en la frecuencia normal.
      </div>
    );
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>
              <Term k="prioridad">Prioridad</Term>
            </th>
            <th>
              <Term k="punto">Punto</Term>
            </th>
            <th>
              <Term k="estado">Estado</Term>
            </th>
            <th>
              <Term k="l">Tamaño de la grieta</Term> / límites
            </th>
            <th>
              <Term k="pesimista">Tiempo hasta Danger</Term>
            </th>
            <th>Qué hacer</th>
            <th className="no-print" />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.point.key} className="clickable" onClick={() => navigate(href.punto(p.point.key))}>
              <td>
                <Prio p={p.priority} title={`${p.priorityName}. ${p.priorityWhy}`} />
              </td>
              <td style={{ minWidth: 180 }}>
                <a className="code" href={href.punto(p.point.key)} onClick={(e) => e.stopPropagation()}>
                  {p.point.code}
                </a>
                {fleet.units.length > 1 && <span className="muted small"> · {p.point.unit}</span>}
                <div className="small muted">{p.point.description}</div>
              </td>
              <td>
                <StatusPill status={p.status} />
              </td>
              <td style={{ minWidth: 150 }}>
                <div className="tab small" style={{ marginBottom: 5 }}>
                  <b style={{ fontWeight: 600 }}>{fmt(p.length)} mm</b>
                  <span className="muted">
                    {' '}
                    / {fmt(p.point.caution)} / {fmt(p.point.danger)}
                  </span>
                </div>
                <LimitBar L={p.length} caution={p.point.caution} danger={p.point.danger} status={p.status} />
              </td>
              <td>
                <DangerETA p={p} />
              </td>
              <td className="small" style={{ minWidth: 220, maxWidth: 340 }}>
                {p.action}
              </td>
              <td className="no-print" onClick={(e) => e.stopPropagation()}>
                {p.openWO ? (
                  <a className="btn sm ghost" href={href.ot(p.openWO.id)}>
                    {p.openWO.id}
                  </a>
                ) : fleet.isPast ? null : (
                  <button className="btn sm" onClick={() => createWO(fleet, p)}>
                    Crear OT
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
