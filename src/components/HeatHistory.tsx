// Historia completa en mapa de calor: filas = puntos agrupados por zona, columnas = inspecciones.
import { useMemo } from 'react';
import { useStore } from '../store';
import { analyze, STATUS_LABEL, type UnitAnalysis } from '../lib/analysis';
import { href, navigate } from '../router';
import type { Status } from '../types';
import { StatusIcon, fmtDate, fmtDateShort, fmtMM } from './ui';

const bg: Record<Status, string> = {
  critico: 'color-mix(in srgb, var(--critico) 62%, var(--sup))',
  alerta: 'color-mix(in srgb, var(--alerta) 50%, var(--sup))',
  normal: 'color-mix(in srgb, var(--normal) 38%, var(--sup))',
  sin: 'var(--sup3)',
  ni: 'transparent',
};

export function HeatHistory({ unitId }: { unitId: string }) {
  const db = useStore((s) => s.db)!;
  const asOf = useStore((s) => s.asOf);
  // La historia se dibuja con todos los datos; lo posterior al corte se ve tenue.
  const full: UnitAnalysis = useMemo(() => analyze(db, null).units.find((u) => u.unitId === unitId)!, [db, unitId]);
  if (!full) return null;
  const events = full.events;
  const zones = db.zones.filter((z) => full.points.some((p) => p.point.zone === z.id));

  return (
    <div>
      <div className="table-wrap" style={{ paddingBottom: 4 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 12 }} className="tab">
          <thead>
            <tr>
              <th style={{ minWidth: 72 }} />
              {events.map((e) => {
                const warn = e.event.flags.some((f) => f.type === 'intervalo' || (f.type === 'parcial' && f.severity === 'warn'));
                const future = asOf && e.event.date > asOf;
                return (
                  <th
                    key={e.event.id}
                    title={`${fmtDate(e.event.date)} · ${e.event.hours?.toLocaleString('es-CO') ?? '—'} h · ${e.event.inspector}${e.event.flags.length ? '\n' + e.event.flags.map((f) => f.message).join('\n') : ''}`}
                    style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      fontWeight: warn ? 600 : 400,
                      color: warn ? 'var(--alerta)' : 'var(--apagado)',
                      opacity: future ? 0.35 : 1,
                      padding: '2px 0 6px',
                      height: 46,
                      textAlign: 'left',
                    }}
                  >
                    {fmtDateShort(e.event.date)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <ZoneRows key={z.id} name={z.name} points={full.points.filter((p) => p.point.zone === z.id)} events={events} asOf={asOf} />
            ))}
          </tbody>
        </table>
      </div>
      <Legend />
    </div>
  );
}

function ZoneRows({ name, points, events, asOf }: { name: string; points: UnitAnalysis['points']; events: UnitAnalysis['events']; asOf: string | null }) {
  return (
    <>
      <tr>
        <td colSpan={events.length + 1} style={{ padding: '10px 0 2px', fontSize: 12.5, color: 'var(--tinta2)', fontWeight: 600 }}>
          {name}
        </td>
      </tr>
      {points.map((p) => (
        <tr key={p.point.key}>
          <td style={{ paddingRight: 8, whiteSpace: 'nowrap' }}>
            <a href={href.punto(p.point.key)} style={{ fontFamily: 'var(--fuente-c)', fontWeight: 600, fontSize: 14.5 }}>
              {p.point.code}
            </a>
          </td>
          {events.map((e) => {
            const s = p.series.find((x) => x.date === e.event.date);
            const future = !!asOf && e.event.date > asOf;
            const L = s?.length ?? null;
            const st: Status = s ? (s.repaired ? 'sin' : s.effStatus) : 'ni';
            const ni = !s || L == null;
            const title = ni
              ? `${p.point.code} · ${fmtDate(e.event.date)}: N/I`
              : `${p.point.code} · ${fmtDate(e.event.date)}: ${L} mm${s!.repaired ? ' · reparada' : ` · ${STATUS_LABEL[st]}`}${s!.excluded ? ' · excluida de la tendencia' : ''}${s!.flags.length ? '\n' + s!.flags.map((f) => f.message).join('\n') : ''}`;
            return (
              <td
                key={e.event.id}
                title={title}
                onClick={() => navigate(href.punto(p.point.key))}
                style={{
                  width: 34,
                  minWidth: 34,
                  height: 26,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: 3,
                  background: ni ? 'repeating-linear-gradient(135deg, var(--sup2) 0 3px, var(--linea) 3px 4.5px)' : bg[st],
                  color: st === 'sin' ? 'var(--apagado)' : 'var(--tinta)',
                  fontWeight: s?.repaired ? 700 : 500,
                  outline: s?.repaired ? '1.5px solid var(--acento)' : s?.excluded ? '1.5px dashed var(--tinta2)' : undefined,
                  outlineOffset: -1.5,
                  opacity: future ? 0.25 : 1,
                  fontSize: 11.5,
                }}
              >
                {ni ? '' : s!.repaired ? 'R' : L === 0 ? '·' : fmtMM(L)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function Legend() {
  const sw = (style: React.CSSProperties, label: string, txt = '') => (
    <span className="row" style={{ gap: 6 }}>
      <span style={{ width: 22, height: 16, borderRadius: 3, display: 'inline-grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, ...style }}>{txt}</span>
      {label}
    </span>
  );
  return (
    <div className="row small muted" style={{ gap: 16, marginTop: 12 }}>
      {(['critico', 'alerta', 'normal'] as Status[]).map((s) => (
        <span key={s} className="row" style={{ gap: 6 }}>
          <span style={{ width: 22, height: 16, borderRadius: 3, background: bg[s], display: 'inline-grid', placeItems: 'center' }}>
            <StatusIcon status={s} size={9} />
          </span>
          {STATUS_LABEL[s]}
        </span>
      ))}
      {sw({ background: bg.sin, color: 'var(--apagado)' }, 'Sin grieta', '·')}
      {sw({ background: bg.sin, outline: '1.5px solid var(--acento)', outlineOffset: -1.5 }, 'Reparada', 'R')}
      {sw({ background: 'repeating-linear-gradient(135deg, var(--sup2) 0 3px, var(--linea) 3px 4.5px)' }, 'N/I')}
      {sw({ background: bg.normal, outline: '1.5px dashed var(--tinta2)', outlineOffset: -1.5 }, 'Excluida de la tendencia')}
      <span>
        <b style={{ color: 'var(--alerta)' }}>aa/mm</b> en ámbar: intervalo largo o inspección parcial
      </span>
      <span>Valores en mm (1.1k = 1.100). Una baja sin reparación conserva el color de la mayor medida del ciclo.</span>
    </div>
  );
}
