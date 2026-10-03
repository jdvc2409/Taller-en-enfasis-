// Rutas por hash para que funcione en GitHub Pages.
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'inicio' }
  | { name: 'flota' }
  | { name: 'equipo'; unit: string }
  | { name: 'zona'; unit: string; zone: string }
  | { name: 'punto'; key: string }
  | { name: 'historial' }
  | { name: 'ot'; id?: string }
  | { name: 'inspeccion'; unit: string }
  | { name: 'datos' }
  | { name: 'no-encontrada'; path: string };

export function parseHash(hash: string): Route {
  const path = decodeURIComponent(hash.replace(/^#/, '').split('?')[0]) || '/';
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return { name: 'inicio' };
  const [a, b, c, d] = parts;
  if (a === 'flota') return { name: 'flota' };
  if (a === 'equipo' && b && c === 'zona' && d) return { name: 'zona', unit: b, zone: d };
  if (a === 'equipo' && b) return { name: 'equipo', unit: b };
  if (a === 'punto' && b) return { name: 'punto', key: parts.slice(1).join('/') };
  if (a === 'historial') return { name: 'historial' };
  if (a === 'ot') return { name: 'ot', id: b };
  if (a === 'inspeccion' && b) return { name: 'inspeccion', unit: b };
  if (a === 'datos') return { name: 'datos' };
  return { name: 'no-encontrada', path };
}

export const href = {
  inicio: () => '#/',
  flota: () => '#/flota',
  equipo: (u: string) => `#/equipo/${encodeURIComponent(u)}`,
  zona: (u: string, z: string) => `#/equipo/${encodeURIComponent(u)}/zona/${encodeURIComponent(z)}`,
  punto: (key: string) => `#/punto/${encodeURIComponent(key)}`,
  historial: () => '#/historial',
  ot: (id?: string) => (id ? `#/ot/${encodeURIComponent(id)}` : '#/ot'),
  inspeccion: (u: string) => `#/inspeccion/${encodeURIComponent(u)}`,
  datos: () => '#/datos',
};

/** Fecha de corte opcional en el enlace: #/punto/...?corte=2024-04-30 */
export function corteFromHash(hash = location.hash): string | null {
  const q = hash.split('?')[1];
  const c = q ? new URLSearchParams(q).get('corte') : null;
  return c && /^\d{4}-\d{2}-\d{2}$/.test(c) ? c : null;
}

export function navigate(h: string) {
  if (location.hash !== h) location.hash = h;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
