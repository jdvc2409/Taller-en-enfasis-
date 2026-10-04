// Estado global (zustand) con persistencia en IndexedDB. Toda lectura o escritura de almacenamiento va en try/catch.
import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { del, get, set } from 'idb-keyval';
import type { DB } from './types';
import { emptyDB, mergeImport, parseWorkbook } from './lib/importer';
import { BUNDLED_EXCEL, BUNDLED_IMAGES, DEFAULT_SETTINGS, POINT_CRITICALITY, POS3D } from './lib/catalog';

const DB_KEY = 'db-v1';
const KEY_KEY = 'anthropic-key';

export type Theme = 'dark' | 'light';

interface State {
  db: DB | null;
  loading: boolean;
  error: string | null;
  asOf: string | null;
  theme: Theme;
  apiKey: string;
  saveError: string | null;
  init: () => Promise<void>;
  setAsOf: (d: string | null) => void;
  update: (fn: (db: DB) => DB) => void;
  replaceDB: (db: DB) => void;
  restoreOriginal: () => Promise<void>;
  setTheme: (t: Theme) => void;
  setApiKey: (k: string) => void;
}

async function loadBundled(): Promise<DB> {
  const res = await fetch(BUNDLED_EXCEL);
  if (!res.ok) throw new Error(`No pude descargar el Excel incluido (${res.status}). Cárguelo manualmente en Datos.`);
  const parsed = parseWorkbook(new Uint8Array(await res.arrayBuffer()));
  const { db, added } = mergeImport(emptyDB(), parsed, 'reemplazar');
  db.pos3d = { ...POS3D };
  db.imports = [
    { at: new Date().toISOString(), file: '631G_historial_grietas.xlsx', mode: 'inicial', added, skipped: 0, warnings: parsed.warnings },
  ];
  return db;
}

/** Completa campos que versiones anteriores de la base no tenían. */
function migrate(db: DB): DB {
  return {
    ...emptyDB(),
    ...db,
    settings: { ...DEFAULT_SETTINGS, ...db.settings },
    // Las posiciones 3D dependen del modelo y no se editan en la interfaz: siempre las del catálogo.
    pos3d: { ...POS3D },
    points: db.points.map((p) =>
      p.criticality === undefined && POINT_CRITICALITY[p.code]
        ? { ...p, criticality: POINT_CRITICALITY[p.code].criticality, criticalityReason: POINT_CRITICALITY[p.code].reason }
        : p,
    ),
  };
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('tema');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* almacenamiento bloqueado */
  }
  return 'light';
}

export const useStore = create<State>((setState, getState) => ({
  db: null,
  loading: true,
  error: null,
  asOf: null,
  theme: readTheme(),
  apiKey: '',
  saveError: null,

  init: async () => {
    try {
      let db: DB | undefined;
      try {
        db = await get<DB>(DB_KEY);
      } catch {
        db = undefined;
      }
      if (!db || !db.inspections?.length) {
        db = await loadBundled();
        try {
          await set(DB_KEY, db);
        } catch {
          /* sin persistencia: la app sigue funcionando en memoria */
        }
      }
      let apiKey = '';
      try {
        apiKey = (await get<string>(KEY_KEY)) ?? '';
      } catch {
        apiKey = '';
      }
      setState({ db: migrate(db), loading: false, apiKey });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  setAsOf: (d) => {
    const db = getState().db;
    const last = db?.events.map((e) => e.date).sort().slice(-1)[0];
    setState({ asOf: d && last && d < last ? d : null });
  },

  update: (fn) => {
    const cur = getState().db;
    if (!cur) return;
    const next = fn(cur);
    setState({ db: next });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await set(DB_KEY, getState().db);
        setState({ saveError: null });
      } catch {
        setState({ saveError: 'No pude guardar en este navegador (almacenamiento bloqueado o lleno). Exporte un respaldo en Datos.' });
      }
    }, 250);
  },

  replaceDB: (db) => getState().update(() => migrate(db)),

  restoreOriginal: async () => {
    const db = await loadBundled();
    try {
      await set(DB_KEY, db);
    } catch {
      /* en memoria */
    }
    setState({ db: migrate(db), asOf: null });
  },

  setTheme: (t) => {
    try {
      localStorage.setItem('tema', t);
    } catch {
      /* preferencia solo para esta sesión */
    }
    setState({ theme: t });
  },

  setApiKey: (k) => {
    setState({ apiKey: k });
    (async () => {
      try {
        if (k) await set(KEY_KEY, k);
        else await del(KEY_KEY);
      } catch {
        /* la clave queda solo en memoria */
      }
    })();
  },
}));

// ---------------------------------------------------------------- imágenes

const urlCache = new Map<string, string>();

export async function saveImage(name: string, blob: Blob) {
  try {
    await set(`img:${name}`, blob);
  } catch {
    throw new Error('No pude guardar la imagen en este navegador (almacenamiento bloqueado o lleno).');
  }
  const old = urlCache.get(name);
  if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
  urlCache.set(name, URL.createObjectURL(blob));
  useStore.getState().update((db) => (db.images.includes(name) ? { ...db } : { ...db, images: [...db.images, name] }));
}

export async function deleteImage(name: string) {
  try {
    await del(`img:${name}`);
  } catch {
    /* nada que borrar */
  }
  const old = urlCache.get(name);
  if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
  urlCache.delete(name);
  useStore.getState().update((db) => ({ ...db, images: db.images.filter((n) => n !== name) }));
}

export async function imageURL(name: string): Promise<string | null> {
  if (!name) return null;
  const hit = urlCache.get(name);
  if (hit) return hit;
  try {
    const blob = await get<Blob>(`img:${name}`);
    if (blob) {
      const u = URL.createObjectURL(blob);
      urlCache.set(name, u);
      return u;
    }
  } catch {
    /* sigue con las incluidas */
  }
  return BUNDLED_IMAGES[name] ?? null;
}

export async function imageBlob(name: string): Promise<Blob | null> {
  try {
    const b = await get<Blob>(`img:${name}`);
    if (b) return b;
  } catch {
    /* incluida */
  }
  const u = BUNDLED_IMAGES[name];
  if (!u) return null;
  const r = await fetch(u);
  return r.ok ? r.blob() : null;
}

/** URL utilizable de una imagen (subida por el usuario o incluida); null mientras carga o si no existe. */
export function useImage(name: string | undefined | null) {
  const images = useStore((s) => s.db?.images);
  const [url, setUrl] = useState<string | null>(name ? (urlCache.get(name) ?? BUNDLED_IMAGES[name] ?? null) : null);
  useEffect(() => {
    let alive = true;
    if (!name) {
      setUrl(null);
      return;
    }
    imageURL(name).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [name, images]);
  return url;
}

export function hasImage(db: DB, name: string) {
  return !!BUNDLED_IMAGES[name] || db.images.includes(name);
}
