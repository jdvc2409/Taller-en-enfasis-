// Matriz de riesgo 5×5: urgencia (probabilidad) en x, consecuencia en y, con el conteo de puntos por celda.
import type { PointAnalysis } from '../lib/analysis';

const tone = (score: number) =>
  score >= 20 ? 'var(--critico-fondo)' : score >= 12 ? 'var(--alerta-fondo)' : score >= 6 ? 'var(--sup2)' : 'var(--sup)';

export function RiskMatrix({ points }: { points: PointAnalysis[] }) {
  const cell = (u: number, c: number) => points.filter((p) => p.urgency === u && p.consequence === c);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '22px repeat(5, minmax(0, 1fr))', gap: 3 }} role="table" aria-label="Matriz de riesgo">
        {[5, 4, 3, 2, 1].map((c) => (
          <div key={c} style={{ display: 'contents' }} role="row">
            <div className="tiny muted" style={{ display: 'grid', placeItems: 'center' }} role="rowheader">
              {c}
            </div>
            {[1, 2, 3, 4, 5].map((u) => {
              const ps = cell(u, c);
              const crack = ps.filter((p) => p.hasCrack);
              return (
                <div
                  key={u}
                  role="cell"
                  title={`Urgencia ${u} × consecuencia ${c} = ${u * c}${ps.length ? `: ${ps.map((p) => p.point.code).join(', ')}` : ''}`}
                  style={{
                    aspectRatio: '1.25',
                    background: tone(u * c),
                    borderRadius: 4,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--fuente)',
                    fontWeight: 600,
                    fontSize: 17,
                    color: crack.length ? 'var(--tinta)' : 'var(--apagado)',
                    border: crack.length ? '2px solid var(--tinta2)' : '1px solid var(--linea)',
                  }}
                >
                  {ps.length || ''}
                </div>
              );
            })}
          </div>
        ))}
        <div />
        {[1, 2, 3, 4, 5].map((u) => (
          <div key={u} className="tiny muted" style={{ textAlign: 'center', paddingTop: 2 }}>
            {u}
          </div>
        ))}
      </div>
      <div className="row tiny muted" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <span>↑ Consecuencia (criticidad)</span>
        <span>Urgencia (probabilidad) →</span>
      </div>
      <p className="tiny muted" style={{ margin: '8px 0 0' }}>
        Celdas con borde: hay puntos con grieta activa. P1 ≥ 20, P2 ≥ 12, P3 ≥ 6. La urgencia sale del tiempo pesimista hasta Danger.
      </p>
    </div>
  );
}
