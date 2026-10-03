// Inicio: la puerta de entrada para alguien que nunca ha usado la plataforma.
// Responde en una frase "¿cómo está la flota?" y ofrece las cuatro cosas que se pueden hacer.
import { Suspense } from 'react';
import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href, navigate } from '../router';
import { Scraper3D } from '../components/Lazy3D';
import { useCreateWO } from '../components/Ranking';
import { Term } from '../components/Help';
import { Icon, StatusIcon, StatusPill, fmt, fmtDate } from '../components/ui';
import type { PointAnalysis } from '../lib/analysis';

function Verdict() {
  const fleet = useAnalysis();
  const createWO = useCreateWO();
  const crit = fleet.points.filter((p) => p.status === 'critico');
  const alert = fleet.points.filter((p) => p.status === 'alerta' || p.unverified);
  const top: PointAnalysis | undefined = crit[0] ?? fleet.ranking[0];
  const tone = crit.length ? 'critico' : alert.length ? 'alerta' : 'normal';

  const title = crit.length
    ? crit.length === 1
      ? `Hay 1 punto que no puede esperar: ${crit[0].point.code}`
      : `Hay ${crit.length} puntos que no pueden esperar`
    : alert.length
      ? `${alert.length} ${alert.length === 1 ? 'punto necesita' : 'puntos necesitan'} reparación programada`
      : 'Todo en orden: ningún punto se acerca al límite';
  const text = crit.length
    ? 'Su grieta alcanzó el límite de operación segura (Danger). El equipo no debe operar hasta repararlo.'
    : alert.length
      ? 'Su grieta pasó el límite de precaución (Caution). Todavía se puede operar, pero hay que planear la reparación.'
      : 'Sigue inspeccionando con la frecuencia normal.';

  return (
    <section className={`verdict ${tone}`} aria-live="polite">
      <div className="verdict-ic" aria-hidden="true">
        <StatusIcon status={tone} size={28} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="verdict-k">Estado de la flota hoy</div>
        <h2 className="verdict-t">{title}</h2>
        <p className="verdict-p">{text}</p>
        {top && top.hasCrack && (
          <div className="verdict-point">
            <StatusPill status={top.status} />
            <span>
              <b>{top.point.code}</b> · {top.point.description}
              {top.length != null && <> · mide {fmt(top.length)} mm (límite {fmt(top.point.danger)} mm)</>}
            </span>
          </div>
        )}
        {top && top.hasCrack && (
          <div className="row" style={{ marginTop: 14 }}>
            <a className="btn primary" href={href.punto(top.point.key)}>
              Ver {top.point.code} y qué hacer
              <Icon name="right" />
            </a>
            {!fleet.isPast &&
              (top.openWO ? (
                <a className="btn" href={href.ot(top.openWO.id)}>
                  Ver su orden de trabajo ({top.openWO.id})
                </a>
              ) : (
                <button className="btn" onClick={() => createWO(fleet, top)}>
                  Crear orden de trabajo
                </button>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Task({ n, title, text, to, icon }: { n: number; title: string; text: string; to: string; icon: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <a className="task" href={to}>
      <span className="task-n" aria-hidden="true">
        {n}
      </span>
      <span className="task-body">
        <span className="task-t">{title}</span>
        <span className="task-p">{text}</span>
      </span>
      <span className="task-go" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
    </a>
  );
}

export function Home() {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const u0 = fleet.units[0];
  const counts = (['critico', 'alerta', 'normal', 'sin', 'ni'] as const).map((s) => [s, fleet.points.filter((p) => p.status === s).length] as const);

  return (
    <div className="stack home">
      <div>
        <h1>Integridad estructural de la flota</h1>
        <p className="lead">Qué grietas reparar primero y cuándo volver a inspeccionar{fleet.lastDate ? ` · última inspección ${fmtDate(fleet.lastDate)}` : ''}.</p>
      </div>

      <Verdict />

      <section aria-labelledby="que-hacer">
        <h2 id="que-hacer" style={{ marginBottom: 12 }}>
          ¿Qué quieres hacer?
        </h2>
        <div className="tasks">
          <Task n={1} title="Ver qué reparar primero" text="La más urgente, arriba." to={href.flota()} icon="right" />
          <Task n={2} title="Registrar una inspección" text="Paso a paso, zona por zona." to={href.inspeccion(u0?.unitId ?? '')} icon="plus" />
          <Task n={3} title="Seguir las reparaciones" text="Órdenes de trabajo abiertas." to={href.ot()} icon="right" />
          <Task n={4} title="Buscar una medición" text="Todo el historial, con filtros." to={href.historial()} icon="right" />
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-h">
            <div>
              <h2>Cómo leer los colores</h2>
              <p>Según cuánto mide la grieta.</p>
            </div>
          </div>
          <div className="panel-b">
            <dl className="legend">
              {counts.map(([s, n]) => (
                <div key={s} className="legend-row">
                  <dt>
                    <StatusPill status={s} />
                  </dt>
                  <dd>
                    {s === 'critico' && (
                      <>
                        Alcanzó <Term k="danger" />. No operar hasta reparar.
                      </>
                    )}
                    {s === 'alerta' && (
                      <>
                        Pasó <Term k="caution" />. Programar la reparación.
                      </>
                    )}
                    {s === 'normal' && <>Grieta pequeña. Seguir vigilando.</>}
                    {s === 'sin' && <>Sin grieta.</>}
                    {s === 'ni' && (
                      <>
                        <Term k="ni">No se inspeccionó</Term> la última vez.
                      </>
                    )}
                  </dd>
                  <span className="legend-n tab">
                    {n} {n === 1 ? 'punto' : 'puntos'}
                  </span>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <div>
              <h2>Tu traílla {u0?.unitId}</h2>
              <p>Gírala con el mouse. Haz clic en un punto para abrirlo.</p>
            </div>
            {u0 && (
              <a className="btn sm" href={href.equipo(u0.unitId)}>
                Ver equipo
              </a>
            )}
          </div>
          <div className="panel-b home-3d">
            {u0 && (
              <Suspense fallback={<div className="empty">Cargando el modelo 3D…</div>}>
                <Scraper3D points={u0.points} pos3d={db.pos3d} onOpen={(k) => navigate(href.punto(k))} height={320} />
              </Suspense>
            )}
          </div>
        </section>
      </div>

    </div>
  );
}
