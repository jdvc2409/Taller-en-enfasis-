import { Suspense, useEffect, useRef } from 'react';
import { useStore } from './store';
import { corteFromHash, href, useRoute, type Route } from './router';
import { Icon, Logo } from './components/ui';
import { HelpButton, ScreenGuide } from './components/Help';
import { useReveal } from './components/Motion';
import { Home } from './views/Home';
import { Fleet } from './views/Fleet';
import { Unit } from './views/Unit';
import { ZoneView } from './views/Zone';
import { PointView } from './views/Point';
import { History } from './views/History';
import { WorkOrders } from './views/WorkOrders';
import { InspectionForm } from './views/InspectionForm';
import { Data } from './views/Data';

function Nav({ route }: { route: Route }) {
  const db = useStore((s) => s.db);
  const unit = db?.units[0]?.id ?? '';
  const items: [string, string, Route['name'][]][] = [
    ['Inicio', href.inicio(), ['inicio']],
    ['Qué reparar', href.flota(), ['flota', 'equipo', 'zona', 'punto']],
    ['Historial', href.historial(), ['historial']],
    ['Órdenes de trabajo', href.ot(), ['ot']],
    ['Registrar inspección', href.inspeccion(unit), ['inspeccion']],
    ['Datos', href.datos(), ['datos']],
  ];
  return (
    <nav className="nav" aria-label="Secciones">
      {items.map(([label, h, names]) => (
        <a key={label} href={h} aria-current={names.includes(route.name) ? 'page' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

function ThemeButton() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="btn ghost icon theme-btn"
      onClick={() => setTheme(next)}
      aria-label={next === 'light' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={next === 'light' ? 'Tema claro' : 'Tema oscuro'}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'inicio':
      return <Home />;
    case 'flota':
      return <Fleet />;
    case 'equipo':
      return <Unit unitId={route.unit} />;
    case 'zona':
      return <ZoneView unitId={route.unit} zoneId={route.zone} />;
    case 'punto':
      return <PointView pointKey={route.key} />;
    case 'historial':
      return <History />;
    case 'ot':
      return <WorkOrders id={route.id} />;
    case 'inspeccion':
      return <InspectionForm unitId={route.unit} />;
    case 'datos':
      return <Data />;
    default:
      return (
        <div className="panel empty">
          No existe la página "{route.path}". <a href={href.inicio()}>Ir al inicio</a>.
        </div>
      );
  }
}

export function App() {
  const route = useRoute();
  const mainRef = useRef<HTMLElement>(null);
  const routeKey = JSON.stringify(route);
  useReveal(mainRef, routeKey);
  const { loading, error, db, init, theme, saveError } = useStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Un enlace con ?corte=aaaa-mm-dd abre la máquina del tiempo en esa fecha.
  const setAsOf = useStore((s) => s.setAsOf);
  useEffect(() => {
    const c = corteFromHash();
    if (c && db) setAsOf(c);
  }, [route, db === null, setAsOf]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href={href.inicio()} aria-label="Integridad Estructural, inicio">
            <Logo />
            <span>Integridad Estructural</span>
          </a>
          <Nav route={route} />
          <HelpButton />
          <ThemeButton />
        </div>
      </header>
      <main className="page" ref={mainRef}>
        {loading && <div className="loading">Cargando el historial de inspecciones…</div>}
        {error && (
          <div className="notice critico">
            <div>
              <b>No pude cargar los datos.</b> {error}{' '}
              <a href={href.datos()}>Ir a Datos para cargar el Excel</a>.
            </div>
          </div>
        )}
        {db && !loading && (
          <Suspense fallback={<div className="loading">Cargando…</div>}>
            <div key={routeKey} className="route-in">
              <ScreenGuide route={route.name} />
              <Page route={route} />
            </div>
          </Suspense>
        )}
      </main>
      {saveError && <div className="toast">{saveError}</div>}
    </>
  );
}
