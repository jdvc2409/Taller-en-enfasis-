import { Suspense, useState } from 'react';
import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href, navigate } from '../router';
import { Scraper3D } from '../components/Lazy3D';
import { Timeline } from '../components/Timeline';
import { HeatHistory } from '../components/HeatHistory';
import { Findings } from '../components/Findings';
import { AIButton } from '../components/AIPanel';
import { KPIs, Panel, StatusIcon, StatusPill, fmt, fmtDate } from '../components/ui';
import { STATUS_RANK, worst } from '../lib/analysis';

export function Unit({ unitId }: { unitId: string }) {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const u = fleet.units.find((x) => x.unitId === unitId);
  if (!u)
    return (
      <div className="panel empty">
        No existe el equipo {unitId}. <a href={href.flota()}>Volver a la flota</a>.
      </div>
    );
  const zones = db.zones.filter((z) => u.points.some((p) => p.point.zone === z.id));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <a href={href.flota()}>{db.fleet}</a>
            <span>/</span>
            <span>{u.unitId}</span>
          </div>
          <h1 className="row" style={{ gap: 14 }}>
            Equipo {u.unitId} <StatusPill status={u.worst} big />
          </h1>
          <p>
            {u.model} · horómetro {fmt(u.nowHours, 1)} h{u.nowEstimated ? ' (estimado)' : ''} · uso {fmt(u.usage, 1)} h/día · última inspección{' '}
            {fmtDate(u.nowDate)}
          </p>
        </div>
        <div className="row">
          <AIButton kind="informe" unitId={u.unitId} />
          {!fleet.isPast && (
            <a className="btn" href={href.inspeccion(u.unitId)}>
              Registrar inspección
            </a>
          )}
        </div>
      </div>

      <Timeline unit={unitId} />

      <KPIs
        items={[
          { label: 'Crítico', value: u.counts.critico, tone: u.counts.critico ? 'critico' : undefined },
          { label: 'Alerta', value: u.counts.alerta, tone: u.counts.alerta ? 'alerta' : undefined },
          { label: 'Normal', value: u.counts.normal },
          { label: 'Sin grieta', value: u.counts.sin },
          {
            label: 'MTBF estructural',
            value: fmt(u.mtbf),
            unit: 'h',
            sub: `Tiempo medio entre reparaciones: ${u.repairs} en ${fmt(u.observedHours)} h`,
            title: 'Tiempo medio entre reparaciones = horas observadas / reparaciones.',
          },
          {
            label: 'MTBF de falla',
            value: fmt(u.mtbfFailure),
            unit: 'h',
            sub: `${u.failures} fallas (sobre Danger o fractura)`,
            title: 'Definición del curso: horas en servicio / fallas. Falla = episodio sobre Danger o fractura reportada.',
          },
          {
            label: 'Horas con punto crítico',
            value: fmt(u.hoursWithCriticalConfirmed),
            unit: 'h',
            sub: `confirmadas; hasta ${fmt(u.hoursWithCritical)} h`,
          },
          {
            label: 'OT abiertas',
            value: fleet.backlog.open,
            sub: `Backlog (trabajo pendiente) ${fmt(fleet.backlog.hh, 1)} h-h = ${fmt(fleet.backlog.weeks, 1)} semanas`,
          },
          {
            label: 'Inspecciones a tiempo',
            value: u.onTimePct == null ? '—' : fmt(u.onTimePct * 100),
            unit: '%',
            sub: `${u.onTimeCount[0]} de ${u.onTimeCount[1]} intervalos ≤ ${fmt(db.settings.targetInterval)} h`,
          },
        ]}
      />

      <div className="grid-main" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
        <Panel title="Modelo 3D" sub="Puntos coloreados por estado. Pase el mouse por una zona de la lista para resaltarla.">
          <Suspense fallback={<div className="empty">Cargando el modelo 3D…</div>}>
            <Scraper3D points={u.points} pos3d={db.pos3d} highlightZone={hoverZone} onOpen={(k) => navigate(href.punto(k))} />
          </Suspense>
        </Panel>
        <Panel title="Zonas" tight>
          {zones.map((z) => {
            const zp = u.points.filter((p) => p.point.zone === z.id);
            const w = worst(zp.map((p) => p.status));
            return (
              <a
                key={z.id}
                href={href.zona(u.unitId, z.id)}
                onMouseEnter={() => setHoverZone(z.id)}
                onMouseLeave={() => setHoverZone(null)}
                onFocus={() => setHoverZone(z.id)}
                onBlur={() => setHoverZone(null)}
                style={{ display: 'block', padding: '14px 18px', borderBottom: '1px solid var(--linea)', color: 'inherit', textDecoration: 'none', background: hoverZone === z.id ? 'var(--sup2)' : undefined }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b style={{ fontWeight: 600 }}>{z.name}</b>
                  <StatusPill status={w} />
                </div>
                <div className="small muted" style={{ margin: '4px 0 8px' }}>
                  Consecuencia {z.criticality}/5 · {zp.length} puntos
                </div>
                <div className="row" style={{ gap: 10 }}>
                  {[...zp]
                    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || a.point.code.localeCompare(b.point.code))
                    .map((p) => (
                      <span key={p.point.key} className="row tiny" style={{ gap: 4 }}>
                        <StatusIcon status={p.status} size={10} />
                        {p.point.code}
                      </span>
                    ))}
                </div>
              </a>
            );
          })}
        </Panel>
      </div>

      <Panel
        title="Historia completa"
        sub={`${u.points.length} puntos × ${u.events.length} inspecciones. Clic en una celda para abrir el punto.`}
      >
        <HeatHistory unitId={u.unitId} />
      </Panel>

      <Panel id="hallazgos" title="Hallazgos" sub="Texto para decidir, ordenado por severidad. Cada hallazgo cita las cifras de donde sale.">
        <Findings items={u.findings} />
      </Panel>
    </div>
  );
}
