import { Suspense } from 'react';
import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href, navigate } from '../router';
import { Scraper3D } from '../components/Lazy3D';
import { Timeline } from '../components/Timeline';
import { Ranking } from '../components/Ranking';
import { RiskMatrix } from '../components/RiskMatrix';
import { Findings } from '../components/Findings';
import { Term } from '../components/Help';
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
            label: (
              <>
                Puntos en <Term k="estado">Crítico</Term>
              </>
            ),
            value: crit,
            tone: crit ? 'critico' : undefined,
            sub: 'No operar hasta reparar',
          },
          {
            label: 'Horas con punto crítico',
            value: fmt(hcc),
            unit: 'h',
            sub: `confirmadas (hasta ${fmt(hc)} h)`,
          },
          {
            label: (
              <>
                <Term k="mtbf">MTBF</Term> estructural
              </>
            ),
            value: fmt(u0?.mtbf),
            unit: 'h',
            sub: `${u0?.repairs ?? 0} reparaciones`,
          },
          {
            label: (
              <>
                <Term k="intervalo">Inspecciones a tiempo</Term>
              </>
            ),
            value: onTime[1] ? fmt((onTime[0] / onTime[1]) * 100) : '—',
            unit: '%',
            sub: `${onTime[0]} de ${onTime[1]}`,
          },
        ]}
      />

      <Panel
        title="Qué atender primero"
        sub="El más urgente, arriba."
        tight
      >
        <Ranking fleet={fleet} rows={fleet.ranking} />
        {rec.length > 0 && (
          <details className="more" style={{ borderTop: '1px solid var(--linea)' }}>
            <summary>
              Ver {rec.length} puntos <Term k="reincidente">reincidentes</Term> (la grieta vuelve después de repararla)
            </summary>
            <div style={{ padding: '0 18px 14px' }}>
            <h3 style={{ marginBottom: 4 }}>Reincidentes: <Term k="causaRaiz">análisis de causa raíz</Term> pendiente</h3>

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
          </details>
        )}
      </Panel>

      <div className="grid-main">
        <div className="stack">
        {u0 && (
          <Panel title="Dónde están las grietas" sub="Gira el modelo con el mouse. Clic en un punto para abrirlo." actions={<a className="btn sm" href={href.equipo(u0.unitId)}>Ver equipo {u0.unitId}</a>}>
            <Suspense fallback={<div className="empty">Cargando el modelo 3D…</div>}>
              <Scraper3D points={u0.points} pos3d={db.pos3d} onOpen={(k) => navigate(href.punto(k))} height={380} />
            </Suspense>
          </Panel>
        )}
        <Panel
          title="Hallazgos principales"
          sub="Haz clic en uno para ver el detalle."
          actions={u0 && <a href={href.equipo(u0.unitId) + '#hallazgos'}>Ver todos los hallazgos</a>}
        >
          <Findings items={fleet.findings} limit={5} />
        </Panel>
        </div>
        <div className="stack">
          {units.map((u) => (
            <UnitCard key={u.unitId} u={u} />
          ))}
          <Panel title={<Term k="matriz" />}>
            <RiskMatrix points={pts} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
