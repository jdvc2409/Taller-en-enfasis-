import { useRef, useState } from 'react';
import { useAnalysis } from '../hooks';
import { deleteImage, saveImage, useImage, useStore } from '../store';
import { href } from '../router';
import type { DB, FlagType, Settings } from '../types';
import { mergeImport, parseWorkbook } from '../lib/importer';
import { askClaude, aiErrorMessage } from '../lib/ai';
import { AI_MODELS, AI_PROXY, BUNDLED_IMAGES } from '../lib/catalog';
import { downloadBlob, exportExcel } from './History';
import { Icon, Panel, Severity, fmt, fmtDate } from '../components/ui';

const FLAG_LABEL: Record<FlagType, string> = {
  atipico: 'Valor atípico (excluido)',
  baja: 'Baja sin reparación',
  'baja-leve': 'Baja leve (dispersión)',
  salto: 'Crecimiento atípico',
  'repara-sin-grieta': 'Reparación sin grieta previa',
  horometro: 'Horómetro inválido',
  intervalo: 'Intervalo largo',
  parcial: 'Inspección parcial',
};

const SETTINGS: { key: keyof Settings; label: string; unit: string; step: number; help: string }[] = [
  { key: 'fastGrowth', label: 'Crecimiento acelerado', unit: 'mm/100 h', step: 1, help: 'Alerta "crece rápido" desde este ritmo.' },
  { key: 'nearCaution', label: 'Cerca de Caution', unit: 'fracción', step: 0.05, help: '0,8 = alerta al 80 % de Caution.' },
  { key: 'alertWindow', label: 'Ventana de alerta', unit: 'h', step: 50, help: 'Alerta si el pesimista llega a Danger antes de estas horas.' },
  { key: 'targetInterval', label: 'Intervalo objetivo', unit: 'h', step: 50, help: 'Entre inspecciones; define "a tiempo" e "intervalo largo".' },
  { key: 'capacity', label: 'Capacidad del taller', unit: 'h-h/semana', step: 8, help: 'Para el backlog en semanas.' },
  { key: 'rate', label: 'Tarifa de mano de obra', unit: 'USD/h', step: 1, help: 'Costo de las OT.' },
];

function Thumb({ name }: { name: string }) {
  const url = useImage(name);
  return url ? <img src={url} alt={name} style={{ width: '100%', height: 96, objectFit: 'contain', background: '#fff', borderRadius: 4, display: 'block' }} /> : <div style={{ height: 96 }} />;
}

export function Data() {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const update = useStore((s) => s.update);
  const replaceDB = useStore((s) => s.replaceDB);
  const restoreOriginal = useStore((s) => s.restoreOriginal);
  const apiKey = useStore((s) => s.apiKey);
  const setApiKey = useStore((s) => s.setApiKey);
  const [mode, setMode] = useState<'agregar' | 'reemplazar'>('agregar');
  const [msg, setMsg] = useState<{ tone: 'info' | 'critico' | 'normal'; text: string } | null>(null);
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [test, setTest] = useState<string | null>(null);
  const xlsRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const importExcel = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = parseWorkbook(new Uint8Array(await f.arrayBuffer()));
      if (mode === 'reemplazar' && !confirm('Reemplazar todo borra el historial actual y las OT. ¿Continuar?')) return;
      let added = 0;
      let skipped = 0;
      update((d) => {
        const r = mergeImport(d, parsed, mode);
        added = r.added;
        skipped = r.skipped;
        return {
          ...r.db,
          imports: [...r.db.imports, { at: new Date().toISOString(), file: f.name, mode, added: r.added, skipped: r.skipped, warnings: parsed.warnings }],
        };
      });
      setMsg({
        tone: 'normal',
        text: `${f.name}: ${added} registros agregados${skipped ? `, ${skipped} ya existían (punto + fecha) y se omitieron` : ''}.${parsed.warnings.length ? ` ${parsed.warnings.length} advertencias en el registro de cargas.` : ''}`,
      });
    } catch (e) {
      setMsg({ tone: 'critico', text: `No pude leer ${f.name}: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      if (xlsRef.current) xlsRef.current.value = '';
    }
  };

  const backup = () => {
    // La clave de API no vive en la base: el respaldo nunca la incluye.
    const json = JSON.stringify({ tipo: 'respaldo-integridad-estructural', fecha: new Date().toISOString(), db }, null, 1);
    downloadBlob(json, `respaldo_integridad_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };
  const restore = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const next: DB = data?.db ?? data;
      if (!Array.isArray(next?.inspections) || !Array.isArray(next?.points) || !Array.isArray(next?.events)) throw new Error('el archivo no tiene la estructura de un respaldo de la plataforma.');
      if (!confirm('Restaurar el respaldo reemplaza todos los datos actuales. ¿Continuar?')) return;
      replaceDB(next);
      setMsg({ tone: 'normal', text: `Respaldo restaurado: ${next.inspections.length} registros, ${next.workOrders?.length ?? 0} OT.` });
    } catch (e) {
      setMsg({ tone: 'critico', text: `No pude restaurar ${f.name}: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      if (jsonRef.current) jsonRef.current.value = '';
    }
  };
  const resetAll = async () => {
    if (!confirm('Se borran las inspecciones registradas, las OT y los cambios, y se vuelve a cargar el Excel original. ¿Continuar?')) return;
    try {
      await restoreOriginal();
      setMsg({ tone: 'normal', text: 'Datos originales restaurados.' });
    } catch (e) {
      setMsg({ tone: 'critico', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const setSetting = (k: keyof Settings, v: number | string) => update((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));
  const setPoint = (key: string, patch: Record<string, unknown>) => update((d) => ({ ...d, points: d.points.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));

  const testAI = async () => {
    setApiKey(keyDraft.trim());
    setTest('Probando…');
    try {
      const out = await askClaude({ apiKey: keyDraft.trim(), model: db.settings.aiModel, text: 'Responde únicamente la palabra: Conectado' });
      setTest(`Conexión correcta con ${db.settings.aiModel}${keyDraft.trim() ? ' (clave propia)' : ' (IA de la plataforma)'}: "${out.trim().slice(0, 40)}"`);
    } catch (e) {
      setTest(aiErrorMessage(e));
    }
  };

  // Calidad
  const insp = fleet.inspections;
  const counts = new Map<FlagType, number>();
  for (const i of insp) for (const f of i.flags) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  for (const e of fleet.events) for (const f of e.flags) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  const flagged = insp.filter((i) => i.flags.length).sort((a, b) => a.date.localeCompare(b.date));
  const longEvents = fleet.events.filter((e) => e.flags.some((f) => f.type !== 'parcial' || f.severity !== 'info'));

  const referenced = [...new Set([...db.inspections.flatMap((i) => [i.image, ...i.photos]), ...db.zones.map((z) => z.image)].filter(Boolean))];
  const library = [...new Set([...Object.keys(BUNDLED_IMAGES), ...db.images])];
  const missingImgs = referenced.filter((n) => !library.includes(n));
  const seenCodes = new Set<string>();
  const uniquePoints = db.points.filter((p) => !seenCodes.has(p.key) && seenCodes.add(p.key));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Datos</h1>
          <p>Todo se guarda en este navegador.</p>
        </div>
      </div>
      {msg && (
        <div className={`notice ${msg.tone}`} role="status">
          <div>{msg.text}</div>
        </div>
      )}

      <Panel title="Carga del Excel" sub="Agrega inspecciones desde un archivo Excel.">
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div className="seg" role="group" aria-label="Modo de carga">
            <button aria-pressed={mode === 'agregar'} onClick={() => setMode('agregar')}>
              Agregar al historial
            </button>
            <button aria-pressed={mode === 'reemplazar'} onClick={() => setMode('reemplazar')}>
              Reemplazar todo
            </button>
          </div>
          <input ref={xlsRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" hidden onChange={(e) => importExcel(e.target.files?.[0])} />
          <button className="btn primary" onClick={() => xlsRef.current?.click()}>
            <Icon name="upload" />
            Cargar Excel
          </button>
          <button className="btn" onClick={() => exportExcel(db)}>
            <Icon name="download" />
            Exportar historial
          </button>
          <span style={{ flex: 1 }} />
          <input ref={jsonRef} type="file" accept=".json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          <button className="btn" onClick={backup}>
            Respaldo JSON
          </button>
          <button className="btn" onClick={() => jsonRef.current?.click()}>
            Restaurar respaldo
          </button>
          <button className="btn danger" onClick={resetAll}>
            Restaurar datos originales
          </button>
        </div>
        <p className="tiny muted" style={{ margin: '10px 0 0' }}>
          "Agregar" no duplica punto + fecha. El respaldo JSON incluye historial, OT, ajustes y nombres de imágenes; nunca la clave de API.
        </p>
        <div className="divider" />
        <h3 style={{ marginBottom: 8 }}>Registro de cargas</h3>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Archivo</th>
                <th>Modo</th>
                <th className="r">Agregados</th>
                <th className="r">Omitidos</th>
                <th>Advertencias</th>
              </tr>
            </thead>
            <tbody>
              {[...db.imports].reverse().map((l, i) => (
                <tr key={i}>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(l.at).toLocaleString('es-CO')}
                  </td>
                  <td>{l.file}</td>
                  <td>{l.mode}</td>
                  <td className="r">{l.added}</td>
                  <td className="r">{l.skipped}</td>
                  <td className="small">{l.warnings.length ? l.warnings.join(' ') : <span className="muted">Ninguna</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Revisión de calidad" sub={`"Los datos vienen de campo: revísenlos antes de confiar en ellos." Marcas recalculadas con cada cambio${fleet.isPast ? `, al ${fmtDate(fleet.asOf)}` : ''}.`}>
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          {[...counts.entries()].map(([t, n]) => (
            <span key={t} className="pill">
              {FLAG_LABEL[t]} <b className="tab">{n}</b>
            </span>
          ))}
          {!counts.size && <span className="muted">Sin observaciones.</span>}
        </div>
        {longEvents.length > 0 && (
          <>
            <h3 style={{ marginBottom: 6 }}>Inspecciones con observaciones</h3>
            <div className="stack" style={{ gap: 6, marginBottom: 16 }}>
              {longEvents.map((e) => (
                <div key={e.id} className="small row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 8 }}>
                  <Severity s={e.flags.some((f) => f.severity === 'error') ? 'error' : 'warn'} />
                  <span>
                    <b>{fmtDate(e.date)}</b> · {e.flags.map((f) => f.message).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <h3 style={{ marginBottom: 6 }}>Registros con observaciones</h3>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th className="r">Fila</th>
                <th>Fecha</th>
                <th>Punto</th>
                <th className="r">mm</th>
                <th>Explicación</th>
                <th>Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((i) => (
                <tr key={i.id}>
                  <td className="r muted">{i.row ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(i.date)}</td>
                  <td>
                    <a className="code" href={href.punto(`${i.unit}|${i.code}`)}>
                      {i.code}
                    </a>
                  </td>
                  <td className="r">{i.length ?? 'N/I'}</td>
                  <td className="small" style={{ minWidth: 300 }}>
                    {i.flags.map((f, k) => (
                      <div key={k} className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                        <Severity s={f.severity} />
                        <span>{f.message}</span>
                      </div>
                    ))}
                  </td>
                  <td>
                    {i.length != null && i.length > 0 && !i.repaired ? (
                      <label className="check small">
                        <input
                          type="checkbox"
                          checked={!i.excluded}
                          onChange={(e) =>
                            update((d) => ({ ...d, inspections: d.inspections.map((x) => (x.id === i.id ? { ...x, override: e.target.checked ? 'include' : 'exclude' } : x)) }))
                          }
                        />
                        {i.excluded ? 'Excluida' : 'Incluida'}
                      </label>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Criticidad de zonas" sub="Consecuencia C de la matriz de riesgo y esquema asignado.">
          <div className="stack" style={{ gap: 16 }}>
            {db.zones.map((z) => (
              <div key={z.id} className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>{z.name}</b>
                  <select
                    value={z.criticality}
                    aria-label={`Consecuencia de ${z.name}`}
                    onChange={(e) => update((d) => ({ ...d, zones: d.zones.map((x) => (x.id === z.id ? { ...x, criticality: Number(e.target.value) } : x)) }))}
                  >
                    {[1, 2, 3, 4, 5].map((c) => (
                      <option key={c} value={c}>
                        C = {c}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={z.reason}
                  rows={2}
                  aria-label={`Justificación de ${z.name}`}
                  onChange={(e) => update((d) => ({ ...d, zones: d.zones.map((x) => (x.id === z.id ? { ...x, reason: e.target.value } : x)) }))}
                />
                <label className="f">
                  Esquema
                  <select value={z.image} onChange={(e) => update((d) => ({ ...d, zones: d.zones.map((x) => (x.id === z.id ? { ...x, image: e.target.value } : x)) }))}>
                    <option value="">Sin esquema</option>
                    {library.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Parámetros" sub="Umbrales de alertas, intervalos y costos.">
          <div className="stack" style={{ gap: 12 }}>
            {SETTINGS.map((s) => (
              <label key={s.key} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 12 }}>
                <span>
                  {s.label}
                  <div className="tiny muted">{s.help}</div>
                </span>
                <span className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <input
                    type="number"
                    step={s.step}
                    min={0}
                    value={db.settings[s.key] as number}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (isFinite(v) && v > 0) setSetting(s.key, v);
                    }}
                    style={{ width: 90, textAlign: 'right' }}
                  />
                  <span className="tiny muted" style={{ width: 74 }}>
                    {s.unit}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Límites por punto" sub="Caution y Danger en mm." tight>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                {fleet.units.length > 1 && <th>Equipo</th>}
                <th>Punto</th>
                <th>Descripción</th>
                <th className="r">Caution</th>
                <th className="r">Danger</th>
                <th className="r">C propia</th>
              </tr>
            </thead>
            <tbody>
              {uniquePoints.map((p) => {
                const bad = !(p.danger > p.caution && p.caution > 0);
                return (
                  <tr key={p.key}>
                    {fleet.units.length > 1 && <td>{p.unit}</td>}
                    <td className="code">{p.code}</td>
                    <td className="small">{p.description}</td>
                    <td className="r">
                      <input type="number" min={0} step={10} value={p.caution} onChange={(e) => setPoint(p.key, { caution: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 84, textAlign: 'right', borderColor: bad ? 'var(--critico)' : undefined }} />
                    </td>
                    <td className="r">
                      <input type="number" min={0} step={10} value={p.danger} onChange={(e) => setPoint(p.key, { danger: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 84, textAlign: 'right', borderColor: bad ? 'var(--critico)' : undefined }} />
                    </td>
                    <td className="r">
                      <select
                        value={p.criticality ?? ''}
                        title={p.criticalityReason}
                        onChange={(e) => setPoint(p.key, { criticality: e.target.value ? Number(e.target.value) : undefined })}
                      >
                        <option value="">Zona</option>
                        {[1, 2, 3, 4, 5].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {uniquePoints.some((p) => !(p.danger > p.caution && p.caution > 0)) && (
          <div className="notice critico small" style={{ margin: 12 }}>
            <div>Hay puntos con límites inválidos (Danger debe ser mayor que Caution y ambos positivos). Corríjalos: el estado de esos puntos no es confiable.</div>
          </div>
        )}
      </Panel>

      <div className="grid-2">
        <Panel title="Inteligencia artificial" sub="La IA funciona para cualquier persona que abra el link, sin pegar ninguna clave.">
          <div className="stack" style={{ gap: 12 }}>
            {AI_PROXY ? (
              <div className="notice normal small">
                <div>
                  <b>IA de la plataforma activa.</b> Las consultas pasan por un servidor intermediario que guarda la clave como secreto: la clave no está en
                  la página ni en el repositorio.
                </div>
              </div>
            ) : (
              <div className="notice alerta small">
                <div>La IA de la plataforma no está configurada en esta versión: use una clave propia.</div>
              </div>
            )}
            <label className="f">
              Clave propia de Anthropic (opcional; se guarda solo en este navegador)
              <input type="password" autoComplete="off" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="sk-ant-…" />
            </label>
            <label className="f">
              Modelo
              <select value={db.settings.aiModel} onChange={(e) => setSetting('aiModel', e.target.value)}>
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <button className="btn primary" onClick={() => (setApiKey(keyDraft.trim()), setTest('Clave guardada en este navegador.'))}>
                Guardar clave
              </button>
              <button className="btn" onClick={testAI} disabled={!keyDraft.trim() && !AI_PROXY}>
                Probar conexión
              </button>
              {apiKey && (
                <button className="btn ghost" onClick={() => (setApiKey(''), setKeyDraft(''), setTest('Clave borrada de este navegador.'))}>
                  Borrar clave
                </button>
              )}
            </div>
            {test && <div className="small">{test}</div>}
            <p className="tiny muted" style={{ margin: 0 }}>
              Si la IA no responde, cada panel ofrece "Copiar para pegar en Claude" con el mensaje completo.
            </p>
          </div>
        </Panel>
        <Panel
          title="Biblioteca de imágenes"
          sub="Esquemas y fotos."
          actions={
            <>
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={async (e) => {
                  for (const f of Array.from(e.target.files ?? [])) {
                    try {
                      await saveImage(f.name, f);
                    } catch (err) {
                      setMsg({ tone: 'critico', text: err instanceof Error ? err.message : String(err) });
                    }
                  }
                  if (imgRef.current) imgRef.current.value = '';
                }}
              />
              <button className="btn sm" onClick={() => imgRef.current?.click()}>
                <Icon name="upload" size={14} />
                Subir imágenes
              </button>
            </>
          }
        >
          {missingImgs.length > 0 && (
            <div className="notice alerta small" style={{ marginBottom: 12 }}>
              <div>Faltan imágenes referenciadas: {missingImgs.join(', ')}.</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {library.map((n) => (
              <figure key={n} style={{ margin: 0 }}>
                <Thumb name={n} />
                <figcaption className="tiny muted" style={{ marginTop: 4, wordBreak: 'break-all' }}>
                  {n}
                  {db.images.includes(n) && (
                    <button className="btn ghost sm" style={{ height: 20, padding: '0 4px', marginLeft: 4 }} onClick={() => confirm(`¿Borrar ${n}?`) && deleteImage(n)} aria-label={`Borrar ${n}`}>
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </Panel>
      </div>
      <p className="tiny muted">
        {db.inspections.length} registros · {db.events.length} inspecciones · {db.points.length} puntos · {db.workOrders.length} OT · {fmt(db.images.length)} imágenes subidas.
      </p>
    </div>
  );
}
