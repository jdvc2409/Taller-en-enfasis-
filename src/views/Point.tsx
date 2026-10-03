import { useMemo, useRef, useState } from 'react';
import { useAnalysis } from '../hooks';
import { saveImage, useImage, useStore } from '../store';
import { href } from '../router';
import { analyze, STATUS_LABEL, fmtH, type Crossing, type PointAnalysis } from '../lib/analysis';
import { stateLabel } from '../lib/ot';
import { Timeline } from '../components/Timeline';
import { Term } from '../components/Help';
import { GrowthChart } from '../components/GrowthChart';
import { Schematic } from '../components/Schematic';
import { AIButton } from '../components/AIPanel';
import { useCreateWO } from '../components/Ranking';
import { Icon, Panel, Prio, Severity, StatusPill, fmt, fmtDate } from '../components/ui';

function Figure({ label, c, kind, p }: { label: string; c: Crossing; kind: 'caution' | 'danger'; p: PointAnalysis }) {
  const past = c.central === 0 && (kind === 'caution' ? p.status === 'alerta' || p.status === 'critico' : p.status === 'critico');
  const color = kind === 'caution' ? 'var(--alerta)' : 'var(--critico)';
  let main: React.ReactNode;
  let sub: React.ReactNode = null;
  if (!p.hasCrack) main = <span className="muted">—</span>;
  else if (past) main = <span style={{ color }}>Ya superado</span>;
  else if (c.pessimistic === 0) {
    main = <span style={{ color }}>Posible ya</span>;
    sub = 'la banda pesimista ya lo alcanza';
  } else if (c.central == null && c.pessimistic == null) main = <span className="muted">Más de 15.000 h</span>;
  else {
    main = (
      <>
        {c.central != null ? fmtH(c.central) : '—'}
        <small>h</small>
      </>
    );
    sub = (
      <>
        {c.pessimistic != null ? fmtH(c.pessimistic) : '—'} – {c.optimistic != null ? fmtH(c.optimistic) : '> 15.000'} h
        {c.date && <> · ≈ {fmtDate(c.date)}</>}
      </>
    );
  }
  return (
    <div className="kpi">
      <div className="kpi-l">{label}</div>
      <div className="kpi-v">{main}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  );
}

function Photo({ name, caption, onOpen }: { name: string; caption: string; onOpen: () => void }) {
  const url = useImage(name);
  return (
    <figure style={{ margin: 0 }}>
      <button onClick={onOpen} style={{ padding: 0, border: '1px solid var(--linea)', borderRadius: 6, overflow: 'hidden', cursor: 'zoom-in', background: 'var(--sup2)', display: 'block', width: '100%' }}>
        {url ? <img src={url} alt={caption} style={{ display: 'block', width: '100%', height: 140, objectFit: 'cover' }} /> : <div style={{ height: 140 }} className="empty small">Sin imagen</div>}
      </button>
      <figcaption className="tiny muted" style={{ marginTop: 5 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

function Lightbox({ name, caption, onClose }: { name: string; caption: string; onClose: () => void }) {
  const url = useImage(name);
  return (
    <div className="ai-overlay" style={{ justifyContent: 'center', alignItems: 'center', padding: 20 }} onClick={onClose} role="dialog" aria-label={caption}>
      <figure style={{ margin: 0, maxWidth: '92vw' }}>
        {url && <img src={url} alt={caption} style={{ maxWidth: '100%', maxHeight: '82vh', display: 'block', borderRadius: 8 }} />}
        <figcaption className="small" style={{ color: '#fff', marginTop: 8 }}>
          {caption} · clic para cerrar
        </figcaption>
      </figure>
    </div>
  );
}

export function PointView({ pointKey }: { pointKey: string }) {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const update = useStore((s) => s.update);
  const asOf = useStore((s) => s.asOf);
  const createWO = useCreateWO();
  const [zoom, setZoom] = useState<{ name: string; caption: string } | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [allRows, setAllRows] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const p = fleet.points.find((x) => x.point.key === pointKey);
  const full = useMemo(() => analyze(db, null).points.find((x) => x.point.key === pointKey), [db, pointKey]);
  if (!p || !full)
    return (
      <div className="panel empty">
        No existe el punto {pointKey}. <a href={href.flota()}>Volver a la flota</a>.
      </div>
    );
  const u = fleet.units.find((x) => x.unitId === p.point.unit)!;
  const zone = db.zones.find((z) => z.id === p.point.zone);
  const future = asOf ? full.series.filter((s) => s.date > asOf) : [];
  const zonePoints = fleet.points.filter((x) => x.point.unit === p.point.unit && x.point.zone === p.point.zone);
  const wos = fleet.workOrders.filter((w) => w.pointKey === p.point.key);
  const tone = p.status === 'critico' ? 'critico' : p.status === 'alerta' || p.unverified ? 'alerta' : p.status === 'normal' ? 'normal' : 'sin';
  const photos = p.series.flatMap((s) => s.photos.map((name) => ({ name, date: s.date, length: s.length })));
  const lastWithMeasure = [...p.series].reverse().find((s) => s.length != null);

  const toggle = (id: string, include: boolean) =>
    update((d) => ({ ...d, inspections: d.inspections.map((i) => (i.id === id ? { ...i, override: include ? 'include' : 'exclude' } : i)) }));

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = [...full.series].reverse()[0];
    if (!target) {
      setUpErr('Este punto no tiene inspecciones: registre una antes de agregar fotos.');
      return;
    }
    setUpErr(null);
    try {
      const names: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) throw new Error(`"${f.name}" no es una imagen.`);
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        let name = `${p.point.unit.split('-')[0]}_${p.point.code}_${target.date}.${ext}`;
        let k = 2;
        while (db.images.includes(name) || names.includes(name)) name = `${p.point.unit.split('-')[0]}_${p.point.code}_${target.date}_${k++}.${ext}`;
        await saveImage(name, f);
        names.push(name);
      }
      update((d) => ({ ...d, inspections: d.inspections.map((i) => (i.id === target.id ? { ...i, photos: [...i.photos, ...names] } : i)) }));
    } catch (e) {
      setUpErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <a href={href.flota()}>{db.fleet}</a>
            <span>/</span>
            <a href={href.equipo(p.point.unit)}>{p.point.unit}</a>
            <span>/</span>
            <a href={href.zona(p.point.unit, p.point.zone)}>{zone?.name}</a>
          </div>
          <h1 className="row" style={{ gap: 12 }}>
            {p.point.code}
            <StatusPill status={p.status} big />
            {p.hasCrack && <Prio p={p.priority} title={p.priorityName} />}
          </h1>
          <p>
            {p.point.description} · <Term k="caution">Caution</Term> (inicio de alerta) <b>{fmt(p.point.caution)} mm</b> ·{' '}
            <Term k="danger">Danger</Term> (límite de operación segura) <b>{fmt(p.point.danger)} mm</b>
          </p>
        </div>
        <div className="row">
          <AIButton kind="diagnostico" pointKey={p.point.key} />
          {!fleet.isPast &&
            p.hasCrack &&
            (p.openWO ? (
              <a className="btn" href={href.ot(p.openWO.id)}>
                Ver {p.openWO.id}
              </a>
            ) : (
              <button className="btn primary" onClick={() => createWO(fleet, p)}>
                Crear orden de trabajo
              </button>
            ))}
        </div>
      </div>

      <Timeline unit={p.point.unit} />

      <div className={`notice ${tone}`}>
        <div>
          <div style={{ fontSize: 16 }}>
            <b>{p.action}</b>
          </div>
          <details className="why">
            <summary>¿Por qué?</summary>
            <div className="small" style={{ marginTop: 4, color: 'var(--tinta2)' }}>
              {p.hasCrack && (
                <>
                  {p.priority} {p.priorityName}: {p.priorityWhy}{' '}
                </>
              )}
              {p.statusNote}
            </div>
          </details>
        </div>
      </div>

      <div className="grid-main">
        <div className="stack">
          <Panel
            title="Evolución de la grieta"
            sub={fleet.isPast ? `Con datos hasta el ${fmtDate(fleet.asOf)}; en gris, lo medido después.` : undefined}
          >
            <GrowthChart pa={p} future={future} nowHours={u.nowHours} nowDate={u.nowDate} usage={u.usageForecast} isPast={fleet.isPast} />
          </Panel>
          <div className="kpis">
            <Figure label="Llega a Caution en" c={p.toCaution} kind="caution" p={p} />
            <Figure label="Llega a Danger en" c={p.toDanger} kind="danger" p={p} />
            <div className="kpi">
              <div className="kpi-l">Ritmo actual</div>
              <div className="kpi-v">
                {p.rate == null ? '—' : fmt(p.rate, 1)}
                {p.rate != null && <small>mm/100 h</small>}
              </div>
              <div className="kpi-s">típico: {fmt(u.typicalRate, 1)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">Próxima inspección</div>
              <div className="kpi-v">
                {p.nextInspection == null ? <span style={{ color: 'var(--critico)' }}>Reparar</span> : <>≤ {fmtH(p.nextInspection)}<small>h</small></>}
              </div>
              <div className="kpi-s">{p.nextInspection == null ? 'antes de operar' : 'de operación'}</div>
            </div>
          </div>
          <details className="why small muted">
            <summary>Cómo se calculó</summary> {p.fit.note}{/[Cc]onfianza/.test(p.fit.note) ? '' : ` Confianza ${p.fit.confidence}.`} Horas convertidas a fecha con {fmt(u.usageForecast, 1)} h/día.
            Rango = escenario pesimista – optimista.
          </details>
        </div>

        <div className="stack">
          <Panel title="Ubicación" tight>
            <div style={{ padding: 12 }}>
              {zone && <Schematic image={zone.image} points={zonePoints} selected={p.point.key} compact />}
            </div>
          </Panel>
          <Panel title="Indicadores del punto">
            <dl className="kv" style={{ margin: 0 }}>
              <dt>Reparaciones</dt>
              <dd>{p.kpis.repairs}</dd>
              <dt>Una reparación cada</dt>
              <dd>{p.kpis.repairEvery == null ? '—' : `${fmt(p.kpis.repairEvery)} h`}</dd>
              <dt>Reaparece tras reparar</dt>
              <dd>{p.kpis.reappearMean == null ? '—' : `${fmt(p.kpis.reappearMean)} h`}</dd>
              <dt>Vida media de la grieta</dt>
              <dd>{p.kpis.lifeMean == null ? '—' : `${fmt(p.kpis.lifeMean)} h`}</dd>
              <dt>Horas sobre Danger</dt>
              <dd>
                {p.kpis.dangerEpisodes ? `${fmt(p.kpis.dangerConfirmed)} – ${fmt(p.kpis.dangerMax)} h` : '0 h'}
              </dd>
              <dt>Consecuencia</dt>
              <dd>{p.consequence} / 5</dd>
            </dl>
            {p.kpis.dangerEpisodes > 0 && (
              <p className="tiny muted" style={{ margin: '10px 0 0' }}>
                {p.kpis.dangerEpisodes} episodio{p.kpis.dangerEpisodes > 1 ? 's' : ''}: confirmadas – hasta la reparación o el corte. Cota superior {fmt(p.kpis.dangerUpper)} h.
              </p>
            )}
          </Panel>
          <Panel title="Alertas">
            {p.alerts.length ? (
              <div className="stack" style={{ gap: 9 }}>
                {p.alerts.map((a, i) => (
                  <div key={i} className="row small" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 9 }}>
                    <Severity s={a.level} />
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small muted">Sin alertas.</div>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        title="Fotos"
        actions={
          !fleet.isPast && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
              <button className="btn sm" onClick={() => fileRef.current?.click()}>
                <Icon name="camera" size={14} />
                Agregar fotos
              </button>
            </>
          )
        }
      >
        {upErr && <div className="notice critico small" style={{ marginBottom: 10 }}>{upErr}</div>}
        {photos.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
            {photos.map((ph) => {
              const caption = `${p.point.code} · ${fmtDate(ph.date)} · ${ph.length == null ? 'N/I' : ph.length + ' mm'}`;
              return (
                <div key={ph.name} className="stack" style={{ gap: 6 }}>
                  <Photo name={ph.name} caption={caption} onOpen={() => setZoom({ name: ph.name, caption })} />
                  <AIButton kind="foto" pointKey={p.point.key} photo={{ name: ph.name, date: ph.date, length: ph.length }} label="Analizar foto" small />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="small muted">
            Sin fotos registradas{lastWithMeasure ? ` (última medida: ${fmtDate(lastWithMeasure.date)})` : ''}.
          </div>
        )}
      </Panel>

      <Panel title="Historial del punto" sub="La medida más reciente arriba." tight>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="r">Horómetro</th>
                <th className="r">L (mm)</th>
                <th>Estado</th>
                <th>Inspector</th>
                <th>Comentario y calidad</th>
                <th>Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {[...p.series].reverse().slice(0, allRows ? undefined : 6).map((s) => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</td>
                  <td className="r">{fmt(s.hours, 1)}</td>
                  <td className="r" style={{ fontWeight: 600 }}>
                    {s.length == null ? 'N/I' : fmt(s.length)}
                  </td>
                  <td>{s.repaired ? <span className="st" style={{ borderColor: 'var(--acento)' }}>Reparada</span> : <StatusPill status={s.status} />}</td>
                  <td>{s.inspector}</td>
                  <td className="small" style={{ minWidth: 260 }}>
                    {s.comment && <div>"{s.comment}"</div>}
                    {s.flags.map((f, i) => (
                      <div key={i} className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start', marginTop: 3, color: 'var(--tinta2)' }}>
                        <Severity s={f.severity} />
                        <span>{f.message}</span>
                      </div>
                    ))}
                    {s.override && <div className="tiny muted" style={{ marginTop: 3 }}>Decisión manual: {s.override === 'include' ? 'incluir' : 'excluir'}.</div>}
                  </td>
                  <td>
                    {s.length != null && !s.repaired && s.length > 0 ? (
                      <label className="check small">
                        <input type="checkbox" checked={!s.excluded} onChange={(e) => toggle(s.id, e.target.checked)} />
                        {s.excluded ? 'Excluida' : 'Incluida'}
                      </label>
                    ) : (
                      <span className="tiny muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.series.length > 6 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--linea)' }}>
            <button className="btn sm" onClick={() => setAllRows((v) => !v)}>
              {allRows ? 'Ver solo las últimas 6' : `Ver las ${p.series.length} mediciones`}
            </button>
          </div>
        )}
      </Panel>

      <Panel title="Órdenes de trabajo de este punto">
        {wos.length ? (
          <div className="stack" style={{ gap: 8 }}>
            {wos.map((w) => (
              <a key={w.id} href={href.ot(w.id)} className="row" style={{ gap: 12 }}>
                <b>{w.id}</b>
                <Prio p={w.priority} />
                <span className="muted">{stateLabel(w.state)}</span>
                <span className="muted small">
                  creada {fmtDate(w.createdAt)} · {STATUS_LABEL[w.statusAtCreation]} {w.lengthAtCreation ?? ''} mm
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="small muted">Ninguna.</div>
        )}
      </Panel>
      {zoom && <Lightbox name={zoom.name} caption={zoom.caption} onClose={() => setZoom(null)} />}
    </div>
  );
}
