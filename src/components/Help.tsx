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

const GUIDES: Partial<Record<Route['name'], { title: string; tip: string }>> = {
  flota: { title: 'Qué reparar primero', tip: 'Arriba lo más urgente. Haz clic en un punto para ver su detalle.' },
  equipo: { title: 'Un equipo', tip: 'Gira el modelo 3D con el mouse. Haz clic en un punto para abrirlo.' },
  zona: { title: 'Una zona', tip: 'Cada círculo es un punto. Haz clic en uno para abrirlo.' },
  punto: { title: 'Una grieta', tip: 'El recuadro de color dice qué hacer. La gráfica muestra cómo ha crecido.' },
  historial: { title: 'Historial', tip: 'Filtra por zona, punto o fecha. Exporta a Excel lo que ves.' },
  ot: { title: 'Reparaciones', tip: 'Cada columna es una etapa. Abre una tarjeta para avanzarla.' },
  inspeccion: { title: 'Nueva inspección', tip: 'Sigue los pasos: datos, cada zona y guardar.' },
  datos: { title: 'Datos', tip: 'Solo para cargar un Excel nuevo o cambiar límites.' },
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
      <span className="help-q" aria-hidden="true">
        ?
      </span>
      <span>
        <b>{g.title}.</b> {g.tip}
      </span>
      <button className="btn sm ghost icon" onClick={() => writeHidden([...readHidden(), route])} aria-label="Ocultar esta ayuda" title="Ocultar">
        <Icon name="x" size={14} />
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
                <h3 style={{ marginBottom: 8 }}>¿Tienes una pregunta?</h3>
                <p className="small" style={{ margin: 0 }}>
                  Usa <b>Pregúntale a la IA</b>, abajo a la derecha en cualquier pantalla. Conoce el historial del equipo y el material del curso, y
                  solo lee: no cambia datos ni crea órdenes de trabajo.
                </p>
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
