import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href } from '../router';
import { Timeline } from '../components/Timeline';
import { Ranking } from '../components/Ranking';
import { RiskMatrix } from '../components/RiskMatrix';
import { Findings } from '../components/Findings';
import { KPIs, Panel, StatusIcon, StatusPill, fmt, fmtDate } from '../components/ui';
import { STATUS_LABEL, type UnitAnalysis } from '../lib/analysis';

function UnitCard({ u }: { u: UnitAnalysis }) {
  return (
    <a href={href.equipo(u.unitId)} className="panel" style={{ display: 'block', padding: '14px 16px', color: 'inherit', textDecoration: 'none' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--fuente-c)', fontWeight: 700, fontSize: 22 }}>{u.unitId}</div>
          <div className="small muted">{u.model}</div>
        </div>
        <StatusPill status={u.worst} />
      </div>
      <dl className="kv" style={{ margin: '12px 0' }}>
        <dt>Horómetro</dt>
        <dd>
          {fmt(u.nowHours, 1)} h{u.nowEstimated ? ' (estimado)' : ''}
        </dd>
        <dt>Última inspección</dt>
        <dd>{fmtDate(u.nowDate)}</dd>
        <dt>Uso</dt>
        <dd>{fmt(u.usage, 1)} h/día</dd>
      </dl>
      <div className="tiny muted" style={{ marginBottom: 6 }}>
        Estado de cada punto
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(u.points.length, 12)}, minmax(0, 1fr))`, gap: 3 }}>
        {u.points.map((p) => (
          <div
            key={p.point.key}
            title={`${p.point.code}: ${STATUS_LABEL[p.status]}${p.length ? ` (${p.length} mm)` : ''}`}
            style={{ display: 'grid', placeItems: 'center', gap: 3, padding: '5px 0', background: 'var(--sup2)', borderRadius: 4 }}
          >
            <StatusIcon status={p.status} size={11} />
            <span style={{ fontSize: 9.5, color: 'var(--apagado)', fontVariantNumeric: 'tabular-nums' }}>{p.point.code.replace(/^[A-Z]+-/, '')}</span>
          </div>
        ))}
      </div>
    </a>
  );
}

export function Fleet() {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const units = fleet.units;
  const pts = fleet.points;
  const crit = pts.filter((p) => p.status === 'critico').length;
  const alert = pts.filter((p) => p.status === 'alerta').length;
  const hc = units.reduce((a, u) => a + u.hoursWithCritical, 0);
  const hcc = units.reduce((a, u) => a + u.hoursWithCriticalConfirmed, 0);
  const u0 = units[0];
  const rec = pts.filter((p) => p.rcaRequired).sort((a, b) => b.kpis.repairs - a.kpis.repairs);
  const lastDate = units.map((u) => u.nowDate).filter(Boolean).sort().slice(-1)[0];

  return (
    <div className="stack">
      <Timeline />
      <div className="page-head">
        <div>
          <h1>{db.fleet || 'Flota'}</h1>
          <p>
            {units.length} {units.length === 1 ? 'equipo' : 'equipos'} · {pts.length} puntos de inspección · {fleet.events.length} inspecciones ·
            última el {fmtDate(lastDate)}
            {crit > 0 && (
              <>
                {' · '}
                <b style={{ color: 'var(--critico)' }}>
                  {crit} {crit === 1 ? 'punto crítico' : 'puntos críticos'}: reparar antes de continuar operando
                </b>
              </>
            )}
          </p>
        </div>
        {!fleet.isPast && (
          <a className="btn primary" href={href.inspeccion(u0?.unitId ?? '')}>
            Registrar inspección
          </a>
        )}
      </div>

      <KPIs
        items={[
          { label: 'Puntos en Crítico', value: crit, tone: crit ? 'critico' : undefined, sub: crit ? 'Fuera de servicio hasta reparar' : 'Ninguno sobre Danger' },
          { label: 'Puntos en Alerta', value: alert, tone: alert ? 'alerta' : undefined, sub: 'Programar reparación' },
          {
            label: 'Horas con punto crítico',
            value: fmt(hcc),
            unit: 'h',
            sub: `confirmadas; hasta ${fmt(hc)} h hasta reparar o al corte`,
            title: 'Confirmadas: de la primera a la última medida crítica. Máximas: hasta la reparación o el corte.',
          },
          {
            label: 'MTBF estructural',
            value: fmt(u0?.mtbf),
            unit: 'h',
            sub: `${u0?.repairs ?? 0} reparaciones; MTBF de falla ${fmt(u0?.mtbfFailure)} h`,
            title: 'Horas observadas / reparaciones (tiempo medio entre reparaciones). MTBF de falla: horas observadas / episodios sobre Danger o fracturas.',
          },
          {
            label: 'OT abiertas',
            value: fleet.backlog.open,
            sub: `backlog ${fmt(fleet.backlog.hh, 1)} h-h = ${fmt(fleet.backlog.weeks, 1)} semanas`,
          },
        ]}
      />

      <div className="grid-main">
        <div className="stack">
          <Panel
            title="Qué atender primero"
            sub="Puntos con grieta activa, ordenados por prioridad = urgencia × consecuencia. El tiempo a Danger va de pesimista a central."
            tight
          >
            <Ranking fleet={fleet} rows={fleet.ranking} />
            {rec.length > 0 && (
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--linea)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Reincidentes: análisis de causa raíz pendiente</div>
                <div className="row" style={{ gap: 6 }}>
                  {rec.map((p) => (
                    <a key={p.point.key} className="pill" href={href.punto(p.point.key)} title={p.point.description}>
                      <b style={{ fontFamily: 'var(--fuente-c)', fontSize: 15 }}>{p.point.code}</b>
                      <span className="muted">
                        {p.kpis.repairs} rep.
                        {p.kpis.reappearMean != null ? ` · reaparece ${fmt(p.kpis.reappearMean)} h` : ''}
                        {!p.recurrent ? ' · operó sobre Danger' : ''}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Hallazgos principales" sub="Generados a partir de los datos, ordenados por severidad." actions={u0 && <a href={href.equipo(u0.unitId) + '#hallazgos'}>Ver todos</a>}>
            <Findings items={fleet.findings} limit={5} />
          </Panel>
        </div>
        <div className="stack">
          {units.map((u) => (
            <UnitCard key={u.unitId} u={u} />
          ))}
          <Panel title="Matriz de riesgo" sub="Conteo de puntos por celda">
            <RiskMatrix points={pts} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
