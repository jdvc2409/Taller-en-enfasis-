// Ayuda integrada: palabras con explicación al hacer clic, guía de cada pantalla y panel de ayuda con el glosario.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryKey } from '../lib/glossary';
import { Icon, StatusPill } from './ui';
import type { Route } from '../router';

// ---------------------------------------------------------------- palabra con explicación

export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const g = GLOSSARY[k] as { term: string; short: string; more?: string };
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      setPos(null);
    };
    const t = setTimeout(() => {
      window.addEventListener('click', close);
      window.addEventListener('keydown', close);
      window.addEventListener('scroll', close, true);
    });
    return () => {
      clearTimeout(t);
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (pos) return setPos(null);
    const r = ref.current!.getBoundingClientRect();
    const x = Math.min(Math.max(r.left, 12), window.innerWidth - 332);
    setPos({ x, y: r.bottom + 6 });
  };

  return (
    <>
      <button ref={ref} type="button" className="term" onClick={toggle} aria-expanded={!!pos}>
        {children ?? g.term}
      </button>
      {pos && (
        <span className="term-pop" role="tooltip" style={{ left: pos.x, top: pos.y }} onClick={(e) => e.stopPropagation()}>
          <b>{g.term}</b>
          <span>{g.short}</span>
          {g.more && <span className="muted">{g.more}</span>}
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------- guía de cada pantalla

const GUIDES: Partial<Record<Route['name'], { title: string; what: string; steps: ReactNode[] }>> = {
  flota: {
    title: 'Qué reparar primero',
    what: 'Aquí están todos los puntos con grieta, del más urgente al menos urgente.',
    steps: [
      'Mira la primera fila de la tabla: es lo que hay que atender antes que nada.',
      'Haz clic en el código de un punto (por ejemplo AP-03) para ver su historia y cuándo llegará al límite.',
      <>Si hay que repararlo, usa el botón “Crear OT” de esa fila.</>,
    ],
  },
  equipo: {
    title: 'Un equipo completo',
    what: 'Todo lo que pasa en una traílla: dónde están sus grietas, cómo han cambiado y qué encontró la plataforma.',
    steps: [
      'En el modelo 3D cada punto tiene el color de su estado. Puedes girarlo con el mouse.',
      'En el mapa de calor cada fila es un punto y cada columna una inspección: así ves cuándo apareció cada grieta.',
      'Haz clic en una zona o en un punto para entrar al detalle.',
    ],
  },
  zona: {
    title: 'Una zona de la traílla',
    what: 'El esquema real de la zona con cada punto de inspección marcado en su lugar.',
    steps: ['Cada círculo es un punto; su color es su estado.', 'Haz clic en un punto para ver su historia completa.'],
  },
  punto: {
    title: 'La historia de una grieta',
    what: 'Cuánto mide la grieta, cómo ha crecido y cuándo llegará al límite.',
    steps: [
      'Lee primero el recuadro de color: dice qué hay que hacer con este punto.',
      'En la gráfica, cada punto es una medición. Las líneas punteadas son los límites Caution y Danger. La banda sombreada es el pronóstico.',
      'Más abajo está cada medición. Si una está mal medida puedes excluirla del pronóstico.',
    ],
  },
  historial: {
    title: 'Todas las mediciones',
    what: 'Cada medida registrada, de la más reciente a la más antigua.',
    steps: ['Usa los filtros para buscar una zona, un punto, un estado o un rango de fechas.', 'Con “Exportar a Excel” descargas lo que ves.'],
  },
  ot: {
    title: 'Órdenes de trabajo',
    what: 'Cada reparación se sigue de principio a fin con una orden de trabajo (OT).',
    steps: [
      'Las columnas son las etapas: Notificación → OT abierta → Planeada → Programada → Ejecutada → Cerrada.',
      'Haz clic en una tarjeta para abrir la OT y avanzarla de etapa.',
      'Al cerrar una OT con el ensayo final aceptado, el punto queda reparado (L = 0).',
    ],
  },
  inspeccion: {
    title: 'Registrar una inspección',
    what: 'Es el mismo formato de papel de campo. Al guardar, todo se recalcula solo.',
    steps: [
      'Arriba, llena la fecha, el horómetro y el inspector.',
      'En cada punto escribe cuánto mide la grieta en mm. Escribe 0 si no hay grieta.',
      'Si no pudiste revisar un punto marca N/I; si se reparó, marca Reparada. El estado se calcula solo.',
      'Al final, pulsa “Guardar inspección”.',
    ],
  },
  datos: {
    title: 'Datos y configuración',
    what: 'Normalmente no necesitas entrar aquí. Sirve para cargar un Excel nuevo, revisar la calidad de los datos o cambiar límites.',
    steps: ['Para agregar inspecciones desde Excel, usa “Carga del Excel”.', 'Si algo se dañó, “Restaurar datos originales” vuelve al inicio.'],
  },
};

const HIDDEN_KEY = 'guias-ocultas';
const readHidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeHidden = (v: string[]) => {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(v));
  } catch {
    /* sin almacenamiento: la guía vuelve a aparecer, no pasa nada */
  }
  window.dispatchEvent(new Event('guias'));
};

export function ScreenGuide({ route }: { route: Route['name'] }) {
  const g = GUIDES[route];
  const [hidden, setHidden] = useState(readHidden);
  useEffect(() => {
    const on = () => setHidden(readHidden());
    window.addEventListener('guias', on);
    return () => window.removeEventListener('guias', on);
  }, []);
  if (!g || hidden.includes(route)) return null;
  return (
    <section className="guide no-print" aria-label="Cómo usar esta pantalla">
      <div className="guide-ic" aria-hidden="true">
        ?
      </div>
      <div className="guide-body">
        <div className="guide-k">Estás en: {g.title}</div>
        <p className="guide-what">{g.what}</p>
        <ol className="guide-steps">
          {g.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
      <button className="btn sm ghost" onClick={() => writeHidden([...readHidden(), route])}>
        Entendido, ocultar
      </button>
    </section>
  );
}

// ---------------------------------------------------------------- panel de ayuda

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('abrir-ayuda', on);
    return () => window.removeEventListener('abrir-ayuda', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const items = Object.values(GLOSSARY as Record<string, { term: string; short: string; more?: string }>).filter(
    (g) => !q || norm(g.term + ' ' + g.short).includes(norm(q)),
  );
  return (
    <>
      <button className="btn ghost help-btn" onClick={() => setOpen(true)}>
        <span className="help-q" aria-hidden="true">
          ?
        </span>
        Ayuda
      </button>
      {open && (
        <div className="ai-overlay" onClick={() => setOpen(false)}>
          <aside className="ai-panel" role="dialog" aria-label="Ayuda" onClick={(e) => e.stopPropagation()}>
            <div className="ai-head">
              <h2>Ayuda</h2>
              <button className="btn ghost icon" onClick={() => setOpen(false)} aria-label="Cerrar la ayuda">
                <Icon name="x" />
              </button>
            </div>
            <div className="ai-body stack">
              <div>
                <h3 style={{ marginBottom: 8 }}>Cómo leer los colores</h3>
                <dl className="legend">
                  <dt><StatusPill status="critico" /></dt>
                  <dd>La grieta alcanzó Danger o hay fractura. El equipo no debe operar hasta repararla.</dd>
                  <dt><StatusPill status="alerta" /></dt>
                  <dd>La grieta pasó Caution. Hay que programar la reparación.</dd>
                  <dt><StatusPill status="normal" /></dt>
                  <dd>Hay grieta, pero es menor que Caution. Se sigue vigilando.</dd>
                  <dt><StatusPill status="sin" /></dt>
                  <dd>No hay grieta.</dd>
                  <dt><StatusPill status="ni" /></dt>
                  <dd>No se pudo inspeccionar ese día.</dd>
                </dl>
              </div>
              <div>
                <h3 style={{ marginBottom: 8 }}>Palabras que vas a ver</h3>
                <input type="search" placeholder="Buscar una palabra…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }} aria-label="Buscar en el glosario" />
                <dl className="gloss">
                  {items.map((g) => (
                    <div key={g.term}>
                      <dt>{g.term}</dt>
                      <dd>
                        {g.short}
                        {g.more && <> {g.more}</>}
                      </dd>
                    </div>
                  ))}
                  {!items.length && <p className="muted">No encontré esa palabra.</p>}
                </dl>
              </div>
              <div>
                <button
                  className="btn"
                  onClick={() => {
                    writeHidden([]);
                    setOpen(false);
                  }}
                >
                  Volver a mostrar las guías de cada pantalla
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
