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
          <div style={{ fontFamily: 'var(--fuente)', fontWeight: 600, fontSize: 22 }}>{u.unitId}</div>
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
  const hc = units.reduce((a, u) => a + u.hoursWithCritical, 0);
  const hcc = units.reduce((a, u) => a + u.hoursWithCriticalConfirmed, 0);
  const u0 = units[0];
  const onTime = units.reduce((a, u) => [a[0] + u.onTimeCount[0], a[1] + u.onTimeCount[1]], [0, 0]);
  const rec = pts.filter((p) => p.rcaRequired).sort((a, b) => b.kpis.repairs - a.kpis.repairs);
  const lastDate = units.map((u) => u.nowDate).filter(Boolean).sort().slice(-1)[0];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{db.fleet || 'Flota'}</h1>
          <p className="row" style={{ gap: 8, color: 'var(--tinta)', fontSize: 16 }}>
            {crit > 0 ? (
              <>
                <StatusIcon status="critico" size={14} />
                <b style={{ fontWeight: 600 }}>
                  {crit} {crit === 1 ? 'punto crítico' : 'puntos críticos'}: reparar antes de continuar operando
                </b>
              </>
            ) : (
              <span>Ningún punto sobre el límite.</span>
            )}
          </p>
          <p className="small" style={{ marginTop: 2 }}>
            {units.length} {units.length === 1 ? 'equipo' : 'equipos'} · {pts.length} puntos de inspección · {fleet.events.length} inspecciones · última el{' '}
            {fmtDate(lastDate)}
          </p>
        </div>
        {!fleet.isPast && (
          <a className="btn primary" href={href.inspeccion(u0?.unitId ?? '')}>
            Registrar inspección
          </a>
        )}
      </div>

      <Timeline />

      <KPIs
        items={[
          {
            label: 'Puntos en Crítico',
            value: crit,
            tone: crit ? 'critico' : undefined,
            sub: 'Grieta sobre Danger (límite de operación segura) o con fractura reportada.',
          },
          {
            label: 'Horas con punto crítico',
            value: fmt(hcc),
            unit: 'h',
            sub: `Operadas con al menos un punto crítico, confirmadas por medición. Hasta ${fmt(hc)} h contando hasta la reparación.`,
          },
          {
            label: 'MTBF estructural',
            value: fmt(u0?.mtbf),
            unit: 'h',
            sub: `MTBF (tiempo medio entre reparaciones): ${u0?.repairs ?? 0} reparaciones en ${fmt(u0?.observedHours)} h.`,
          },
          {
            label: 'Inspecciones a tiempo',
            value: onTime[1] ? fmt((onTime[0] / onTime[1]) * 100) : '—',
            unit: '%',
            sub: `${onTime[0]} de ${onTime[1]} intervalos dentro del objetivo de ${fmt(db.settings.targetInterval)} h.`,
          },
        ]}
      />

      <Panel
        title="Qué atender primero"
        sub="Puntos con grieta, ordenados por prioridad (urgencia × consecuencia; P1 es inmediata). El tiempo a Danger va del escenario pesimista al central."
        tight
      >
        <Ranking fleet={fleet} rows={fleet.ranking} />
        {rec.length > 0 && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--linea)' }}>
            <h3 style={{ marginBottom: 4 }}>Reincidentes: análisis de causa raíz pendiente</h3>
            <p className="small muted" style={{ margin: '0 0 10px' }}>
              Puntos reparados dos o más veces, o que ya operaron sobre Danger. Volver a soldar no elimina la causa.
            </p>
            <div className="row" style={{ gap: 6 }}>
              {rec.map((p) => (
                <a key={p.point.key} className="pill" href={href.punto(p.point.key)} title={p.point.description}>
                  <b style={{ fontWeight: 600 }}>{p.point.code}</b>
                  <span className="muted">
                    {p.kpis.repairs} {p.kpis.repairs === 1 ? 'reparación' : 'reparaciones'}
                    {p.kpis.reappearMean != null ? ` · reaparece a las ${fmt(p.kpis.reappearMean)} h` : ''}
                    {!p.recurrent ? ' · operó sobre Danger' : ''}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid-main">
        <Panel
          title="Hallazgos principales"
          sub="Generados a partir de los datos, del más grave al menos grave."
          actions={u0 && <a href={href.equipo(u0.unitId) + '#hallazgos'}>Ver todos los hallazgos</a>}
        >
          <Findings items={fleet.findings} limit={5} />
        </Panel>
        <div className="stack">
          {units.map((u) => (
            <UnitCard key={u.unitId} u={u} />
          ))}
          <Panel title="Matriz de riesgo" sub="Cantidad de puntos según urgencia (probabilidad) y consecuencia.">
            <RiskMatrix points={pts} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
