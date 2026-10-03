import { useState } from 'react';
import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href, navigate } from '../router';
import type { WOMaterial, WOOperation, WorkOrder } from '../types';
import { STATUS_LABEL, addDays, woDuration, woManHours, type FleetAnalysis } from '../lib/analysis';
import { ISO, MAINTENANCE_TYPES, WO_STATES, advanceWO, closeWO, nextState, stateLabel, today, type CloseInput } from '../lib/ot';
import { daysBetween } from '../lib/quality';
import { useCreateWO } from '../components/Ranking';
import { Icon, KPIs, LimitBar, Panel, Prio, StatusPill, fmt, fmtDate } from '../components/ui';

export function WorkOrders({ id }: { id?: string }) {
  return id ? <WODoc id={id} /> : <WOBoard />;
}

function WOBoard() {
  const fleet = useAnalysis();
  const createWO = useCreateWO();
  const wos = fleet.workOrders;
  const suggested = fleet.ranking.filter((p) => !p.openWO && ['P1', 'P2', 'P3'].includes(p.priority));
  const pointOf = (w: WorkOrder) => fleet.points.find((p) => p.point.key === w.pointKey);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Órdenes de trabajo</h1>
          <p>
            Ciclo de la OT: Notificación → Aprobación (OT abierta) → Planeación → Programación → Ejecución → Reporte y cierre.
            {fleet.isPast && ` Estado al ${fmtDate(fleet.asOf)}.`}
          </p>
        </div>
      </div>
      <KPIs
        items={[
          { label: 'OT abiertas', value: fleet.backlog.open },
          { label: 'Backlog', value: fmt(fleet.backlog.hh, 1), unit: 'h-h', sub: 'OT no ejecutadas ni cerradas (solo estructurales)' },
          { label: 'Backlog en semanas', value: fmt(fleet.backlog.weeks, 1), unit: 'sem', sub: `capacidad ${fmt(fleet.settings.capacity)} h-h/semana` },
          { label: 'P1 abiertas', value: fleet.backlog.p1, tone: fleet.backlog.p1 ? 'critico' : undefined },
          { label: 'Cerradas', value: fleet.backlog.closed },
        ]}
      />
      <Panel title="Sugeridas por la plataforma" sub="Puntos con grieta en prioridad P1 a P3 que todavía no tienen OT." tight>
        {suggested.length ? (
          <div className="table-wrap">
            <table className="t">
              <tbody>
                {suggested.map((p) => (
                  <tr key={p.point.key}>
                    <td style={{ width: 50 }}>
                      <Prio p={p.priority} />
                    </td>
                    <td>
                      <a className="code" href={href.punto(p.point.key)}>
                        {p.point.code}
                      </a>
                      <div className="small muted">{p.point.description}</div>
                    </td>
                    <td>
                      <StatusPill status={p.status} />
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <LimitBar L={p.length} caution={p.point.caution} danger={p.point.danger} status={p.status} />
                    </td>
                    <td className="small" style={{ maxWidth: 340 }}>
                      {p.action}
                    </td>
                    <td className="r">
                      {!fleet.isPast && (
                        <button className="btn sm primary" onClick={() => createWO(fleet, p)}>
                          Crear OT
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty small">No hay puntos pendientes de OT.</div>
        )}
      </Panel>

      <section aria-label="Tablero de OT">
        <div className="kanban">
          {WO_STATES.map((st) => {
            const col = wos.filter((w) => w.state === st.id);
            return (
              <div key={st.id} className="kcol">
                <div className="kcol-h" title={st.help}>
                  <span>{st.label}</span>
                  <span className="muted tab">{col.length}</span>
                </div>
                {col.map((w) => {
                  const p = pointOf(w);
                  const late = w.dueDate && w.state !== 'cerrada' && w.state !== 'ejecutada' && w.dueDate < (fleet.asOf ?? today());
                  return (
                    <a key={w.id} className="kcard" href={href.ot(w.id)}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{w.id}</b>
                        <Prio p={w.priority} />
                      </div>
                      <div style={{ fontFamily: 'var(--fuente)', fontWeight: 600, fontSize: 16, marginTop: 4 }}>{p?.point.code ?? w.pointKey}</div>
                      <div className="tiny muted">{w.maintenanceType}</div>
                      <div className="tiny" style={{ marginTop: 6, color: late ? 'var(--critico)' : 'var(--tinta2)' }}>
                        Límite {fmtDate(w.dueDate)} · {fmt(woManHours(w), 1)} h-h
                      </div>
                    </a>
                  );
                })}
                {!col.length && <div className="tiny muted" style={{ padding: '8px 4px' }}>Vacío</div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function num(v: string) {
  const n = Number(v.replace(',', '.'));
  return isFinite(n) ? n : 0;
}

function WODoc({ id }: { id: string }) {
  const fleet = useAnalysis();
  const update = useStore((s) => s.update);
  const [closing, setClosing] = useState(false);
  const wo = fleet.workOrders.find((w) => w.id === id);
  if (!wo)
    return (
      <div className="panel empty">
        No existe la OT {id}{fleet.isPast ? ' en la fecha de corte' : ''}. <a href={href.ot()}>Volver a las órdenes de trabajo</a>.
      </div>
    );
  const p = fleet.points.find((x) => x.point.key === wo.pointKey);
  const unit = fleet.units.find((u) => u.unitId === wo.pointKey.split('|')[0]);
  const ro = fleet.isPast || wo.state === 'cerrada';
  // Un punto Crítico, fracturado o posiblemente crítico no admite bajar la prioridad ni diferir la reparación.
  const locked = !!p && (p.status === 'critico' || p.fractured || p.unverified || (p.priority === 'P1' && wo.priority === 'P1'));
  const pointLast = p?.series.filter((s) => s.length != null).slice(-1)[0]?.date ?? unit?.nowDate ?? '2000-01-01';
  const lateDue = !!(wo.dueDate && p?.toDanger.datePess && wo.dueDate > p.toDanger.datePess && p.status !== 'critico');
  const set = (patch: Partial<WorkOrder>) => update((d) => ({ ...d, workOrders: d.workOrders.map((w) => (w.id === wo.id ? { ...w, ...patch } : w)) }));
  const setOp = (opId: string, patch: Partial<WOOperation>) => set({ operations: wo.operations.map((o) => (o.id === opId ? { ...o, ...patch } : o)) });
  const setMat = (mId: string, patch: Partial<WOMaterial>) => set({ materials: wo.materials.map((m) => (m.id === mId ? { ...m, ...patch } : m)) });
  const hh = woManHours(wo);
  const dur = woDuration(wo);
  const nx = nextState(wo.state);

  const advance = () => {
    if (nx === 'cerrada') setClosing(true);
    else update((d) => ({ ...d, workOrders: d.workOrders.map((w) => (w.id === wo.id ? advanceWO(w) : w)) }));
  };
  const remove = () => {
    if (!confirm(`¿Eliminar ${wo.id}? Esta acción no se puede deshacer.`)) return;
    update((d) => ({ ...d, workOrders: d.workOrders.filter((w) => w.id !== wo.id) }));
    navigate(href.ot());
  };

  const field = (label: string, el: React.ReactNode) => (
    <label className="f" key={label}>
      {label}
      {el}
    </label>
  );

  return (
    <div className="stack wo-doc">
      <div className="page-head">
        <div>
          <div className="crumbs no-print">
            <a href={href.ot()}>Órdenes de trabajo</a>
            <span>/</span>
            <span>{wo.id}</span>
          </div>
          <h1 className="row" style={{ gap: 12 }}>
            Orden de trabajo {wo.id} <Prio p={wo.priority} /> <span className="pill">{stateLabel(wo.state)}</span>
          </h1>
          <p>
            {p ? (
              <a href={href.punto(p.point.key)}>
                {p.point.code} · {p.point.description}
              </a>
            ) : (
              wo.pointKey
            )}
          </p>
        </div>
        <div className="row no-print">
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" />
            Imprimir / PDF
          </button>
          {!fleet.isPast && nx && (
            <button className="btn primary" onClick={advance}>
              {nx === 'cerrada' ? 'Reportar y cerrar' : `Pasar a ${stateLabel(nx)}`}
            </button>
          )}
        </div>
      </div>

      <div className="notice alerta small">
        <div>
          <b>Plantilla de referencia, no es un procedimiento aprobado.</b> Los tiempos, operaciones y materiales son una base de planeación: validar contra el
          procedimiento del fabricante y la WPS calificada antes de ejecutar.
        </div>
      </div>

      <ol className="wo-steps no-print" aria-label="Historia de estados">
        {WO_STATES.map((s) => {
          const h = wo.history.filter((x) => x.state === s.id).slice(-1)[0];
          const done = !!h;
          return (
            <li key={s.id} className={done ? 'done' : ''} title={s.help}>
              <span>{s.label}</span>
              <span className="tiny muted">{h ? fmtDate(h.at.slice(0, 10)) : '—'}</span>
            </li>
          );
        })}
      </ol>

      <Panel title="1. Encabezado">
        <div className="form-grid">
          {field(
            'Tipo de mantenimiento',
            <select value={wo.maintenanceType} disabled={ro || locked} onChange={(e) => set({ maintenanceType: e.target.value })}>
              {[...new Set([wo.maintenanceType, ...MAINTENANCE_TYPES])].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>,
          )}
          {field('Tipo de notificación', <input value={wo.notificationType} disabled={ro} onChange={(e) => set({ notificationType: e.target.value })} />)}
          {field(
            'Prioridad',
            <select value={wo.priority} disabled={ro || locked} onChange={(e) => set({ priority: e.target.value as WorkOrder['priority'] })}>
              {['P1', 'P2', 'P3', 'P4'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>,
          )}
          {field('Fecha de creación', <input type="date" value={wo.createdAt} disabled />)}
          {field(
            'Fecha límite (antes de Danger)',
            <>
              <input type="date" value={wo.dueDate ?? ''} disabled={ro} onChange={(e) => set({ dueDate: e.target.value || null })} />
              {lateDue && <span className="tiny" style={{ color: 'var(--alerta)' }}>Posterior a la fecha pesimista de Danger ({fmtDate(p!.toDanger.datePess)}).</span>}
            </>,
          )}
          {field('Fecha programada', <input type="date" value={wo.scheduledDate ?? ''} disabled={ro} onChange={(e) => set({ scheduledDate: e.target.value || null })} />)}
        </div>
        {locked && !ro && (
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            Tipo y prioridad bloqueados: el punto está {p!.status === 'critico' ? 'Crítico' : 'en P1'}{p!.fractured ? ' con fractura reportada' : ''}
            {p!.unverified ? ' (posible crítico no verificado)' : ''}. No se puede diferir ni bajar la prioridad mientras siga así.
          </p>
        )}
        <label className="f" style={{ marginTop: 14 }}>
          Descripción
          <textarea value={wo.description} disabled={ro} rows={4} onChange={(e) => set({ description: e.target.value })} />
        </label>
      </Panel>

      <Panel title="2. Objeto técnico y clasificación ISO 14224">
        <div className="form-grid">
          {field('Equipo y ubicación técnica', <input value={wo.location} disabled={ro} onChange={(e) => set({ location: e.target.value })} />)}
          {field(
            'Estado al crear',
            <input value={`${STATUS_LABEL[wo.statusAtCreation]}${wo.lengthAtCreation != null ? ` · ${wo.lengthAtCreation} mm` : ''}`} disabled />,
          )}
          {(
            [
              ['Modo de falla', 'failureMode', ISO.failureMode],
              ['Mecanismo de falla', 'mechanism', ISO.mechanism],
              ['Causa de falla', 'cause', ISO.cause],
              ['Método de detección', 'detection', ISO.detection],
              ['Actividad de mantenimiento', 'activity', ISO.activity],
            ] as const
          ).map(([label, key, opts]) =>
            field(
              label,
              <select key={key} value={wo[key]} disabled={ro} onChange={(e) => set({ [key]: e.target.value } as Partial<WorkOrder>)}>
                {[...new Set([wo[key], ...opts])].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>,
            ),
          )}
        </div>
      </Panel>

      <Panel title="3. Operaciones" sub="Tiempos de referencia que escalan con k = máx(0,5; L/100)." tight>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Operación</th>
                <th className="r">Personas</th>
                <th className="r">Duración (h)</th>
                <th className="r">h-h</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {wo.operations.map((o, i) => (
                <tr key={o.id}>
                  <td className="muted">{(i + 1) * 10}</td>
                  <td style={{ minWidth: 320 }}>
                    <textarea value={o.text} rows={2} disabled={ro} onChange={(e) => setOp(o.id, { text: e.target.value })} style={{ width: '100%', minHeight: 0 }} />
                  </td>
                  <td className="r">
                    <input type="number" min={1} step={1} value={o.people} disabled={ro} onChange={(e) => setOp(o.id, { people: Math.max(1, Math.round(num(e.target.value))) })} style={{ width: 64, textAlign: 'right' }} />
                  </td>
                  <td className="r">
                    <input type="number" min={0} step={0.1} value={o.hours} disabled={ro} onChange={(e) => setOp(o.id, { hours: Math.max(0, num(e.target.value)) })} style={{ width: 76, textAlign: 'right' }} />
                  </td>
                  <td className="r tab">{fmt(o.people * o.hours, 1)}</td>
                  <td className="no-print">
                    {!ro && (
                      <button className="btn ghost icon sm" aria-label="Quitar operación" onClick={() => set({ operations: wo.operations.filter((x) => x.id !== o.id) })}>
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ro && (
          <div style={{ padding: '10px 18px' }} className="no-print">
            <button className="btn sm" onClick={() => set({ operations: [...wo.operations, { id: Math.random().toString(36).slice(2, 9), text: 'Nueva operación', people: 1, hours: 1 }] })}>
              <Icon name="plus" size={14} />
              Agregar operación
            </button>
          </div>
        )}
      </Panel>

      <div className="grid-2">
        <Panel title="4. Materiales" tight>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="r">Cantidad</th>
                  <th>Unidad</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {wo.materials.map((m) => (
                  <tr key={m.id}>
                    <td style={{ minWidth: 200 }}>
                      <input value={m.text} disabled={ro} onChange={(e) => setMat(m.id, { text: e.target.value })} style={{ width: '100%' }} />
                    </td>
                    <td className="r">
                      <input type="number" min={0} value={m.qty} disabled={ro} onChange={(e) => setMat(m.id, { qty: Math.max(0, num(e.target.value)) })} style={{ width: 70, textAlign: 'right' }} />
                    </td>
                    <td>
                      <input value={m.unit} disabled={ro} onChange={(e) => setMat(m.id, { unit: e.target.value })} style={{ width: 60 }} />
                    </td>
                    <td className="no-print">
                      {!ro && (
                        <button className="btn ghost icon sm" aria-label="Quitar material" onClick={() => set({ materials: wo.materials.filter((x) => x.id !== m.id) })}>
                          <Icon name="x" size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ro && (
            <div style={{ padding: '10px 18px' }} className="no-print">
              <button className="btn sm" onClick={() => set({ materials: [...wo.materials, { id: Math.random().toString(36).slice(2, 9), text: 'Nuevo material', qty: 1, unit: 'u' }] })}>
                <Icon name="plus" size={14} />
                Agregar material
              </button>
            </div>
          )}
        </Panel>
        <Panel title="5. Costo">
          <dl className="kv" style={{ margin: 0, fontSize: 15 }}>
            <dt>Duración de las operaciones</dt>
            <dd>{fmt(dur, 1)} h</dd>
            <dt>Mano de obra</dt>
            <dd>{fmt(hh, 1)} h-h</dd>
            <dt>Tarifa</dt>
            <dd>
              <input type="number" min={0} value={wo.rate} disabled={ro} onChange={(e) => set({ rate: Math.max(0, num(e.target.value)) })} style={{ width: 80, textAlign: 'right' }} /> USD/h
            </dd>
            <dt>Mano de obra</dt>
            <dd>{fmt(hh * wo.rate)} USD</dd>
            <dt>Materiales, repuestos y otros</dt>
            <dd>
              <input type="number" min={0} value={wo.otherCost ?? 0} disabled={ro} onChange={(e) => set({ otherCost: Math.max(0, num(e.target.value)) })} style={{ width: 90, textAlign: 'right' }} /> USD
            </dd>
            <dt style={{ fontWeight: 600, color: 'var(--tinta)' }}>Costo total de la OT</dt>
            <dd style={{ fontFamily: 'var(--fuente)', fontSize: 24, fontWeight: 600 }}>{fmt(hh * wo.rate + (wo.otherCost ?? 0))} USD</dd>
          </dl>
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            Base para el CMF (costo de mantenimiento / facturación) y el CPMV (costo de mantenimiento / valor de reposición).
          </p>
          {wo.state === 'cerrada' && (
            <>
              <div className="divider" />
              <dl className="kv" style={{ margin: 0 }}>
                <dt>Cerrada el</dt>
                <dd>{fmtDate(wo.closeDate)}</dd>
                <dt>Horómetro</dt>
                <dd>{fmt(wo.closeHours, 1)} h</dd>
              </dl>
              {wo.report && <p className="small" style={{ marginBottom: 0 }}>Reporte: {wo.report}</p>}
            </>
          )}
        </Panel>
      </div>
      {!fleet.isPast && wo.state === 'notificacion' && (
        <div className="no-print">
          <button className="btn danger sm" onClick={remove}>
            Eliminar OT
          </button>
        </div>
      )}
      {closing && unit && (
        <CloseDialog
          wo={wo}
          fleet={fleet}
          defaultHours={unit.nowHours != null && unit.nowDate && unit.usageForecast ? Math.round((unit.nowHours + Math.max(daysBetween(unit.nowDate, today()), 0) * unit.usageForecast) * 10) / 10 : 0}
          minHours={unit.nowHours ?? 0}
          minDate={pointLast}
          onCancel={() => setClosing(false)}
          onClose={(c) => {
            update((d) => closeWO(d, d.workOrders.find((w) => w.id === wo.id)!, c));
            setClosing(false);
          }}
        />
      )}
    </div>
  );
}

function CloseDialog({
  wo,
  defaultHours,
  minHours,
  minDate,
  onCancel,
  onClose,
}: {
  wo: WorkOrder;
  fleet: FleetAnalysis;
  defaultHours: number;
  minHours: number;
  minDate: string;
  onCancel: () => void;
  onClose: (c: CloseInput) => void;
}) {
  const [date, setDate] = useState(today() <= minDate ? addDays(minDate, 1) : today());
  const [hours, setHours] = useState(String(defaultHours));
  const [report, setReport] = useState('');
  const [register, setRegister] = useState(true);
  const [ndtOk, setNdtOk] = useState(true);
  const [residual, setResidual] = useState('');
  const h = num(hours);
  const errors: string[] = [];
  if (date <= minDate) errors.push(`La fecha de cierre debe ser posterior a la última medida del punto (${fmtDate(minDate)}), para no reemplazar esa evidencia.`);
  if (!(h >= minHours)) errors.push(`El horómetro no puede ser menor que el último registrado (${fmt(minHours, 1)} h).`);
  if (!report.trim()) errors.push('Escriba el reporte del trabajo realizado.');
  if (register && !ndtOk && !(num(residual) > 0)) errors.push('Indique la longitud residual que mostró el END final.');

  return (
    <div className="ai-overlay" style={{ justifyContent: 'center', alignItems: 'center', padding: 16 }} role="dialog" aria-modal="true" aria-label={`Cerrar ${wo.id}`}>
      <div className="panel" style={{ width: 'min(540px, 100%)', maxHeight: '92vh', overflow: 'auto' }}>
        <div className="panel-h">
          <h2>Reporte y cierre de {wo.id}</h2>
        </div>
        <div className="panel-b stack" style={{ gap: 14 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <label className="f">
              Fecha de cierre
              <input type="date" value={date} min={addDays(minDate, 1)} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="f">
              Horómetro al cierre (h)
              <input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
          </div>
          <label className="f">
            Reporte del trabajo
            <textarea value={report} onChange={(e) => setReport(e.target.value)} placeholder="Qué se hizo, hallazgos, desviaciones del plan, END final…" />
          </label>
          <label className="check">
            <input type="checkbox" checked={register} onChange={(e) => setRegister(e.target.checked)} />
            Registrar la reparación en el historial
          </label>
          {register && (
            <div className="panel inset" style={{ padding: 12 }}>
              <label className="check">
                <input type="checkbox" checked={ndtOk} onChange={(e) => setNdtOk(e.target.checked)} />
                END final aceptado (sin indicaciones)
              </label>
              {ndtOk ? (
                <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                  Se agrega una medida L = 0 "reparada" el {fmtDate(date)} y el punto empieza un ciclo nuevo.
                </p>
              ) : (
                <label className="f" style={{ marginTop: 10 }}>
                  Longitud residual medida en el END final (mm)
                  <input inputMode="decimal" value={residual} onChange={(e) => setResidual(e.target.value)} />
                  <span className="tiny muted">No se registra como reparación: la OT queda Ejecutada con retrabajo pendiente y el punto sigue en su estado hasta un END aceptado.</span>
                </label>
              )}
            </div>
          )}
          {!register && (
            <p className="tiny" style={{ margin: 0, color: 'var(--alerta)' }}>
              Sin registrar la reparación, el punto seguirá en su estado actual y volverá a aparecer en "Sugeridas".
            </p>
          )}
          {errors.length > 0 && (
            <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--alerta)' }}>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onCancel}>
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={errors.length > 0}
              onClick={() => onClose({ date, hours: h, report: report.trim(), register, ndtOk, residual: ndtOk ? null : num(residual) })}
            >
              {register && !ndtOk ? 'Registrar retrabajo' : 'Cerrar OT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
