// Registrar inspección: réplica digital del formato de campo 631G_formato_inspeccion.docx.
import { useMemo, useState } from 'react';
import { useAnalysis } from '../hooks';
import { saveImage, useStore } from '../store';
import { href, navigate } from '../router';
import type { Inspection, InspectionEvent } from '../types';
import { STATUS_LABEL, statusOf } from '../lib/analysis';
import { toNumber } from '../lib/importer';
import { daysBetween } from '../lib/quality';
import { today } from '../lib/ot';
import { Schematic } from '../components/Schematic';
import { Icon, Panel, StatusPill, fmt, fmtDate } from '../components/ui';

interface Row {
  L: string;
  ni: boolean;
  rep: boolean;
  comment: string;
  files: File[];
}

const CRITERIA = [
  { s: 'normal' as const, t: 'L actual menor que Caution. Seguimiento en la frecuencia normal.' },
  { s: 'alerta' as const, t: 'L actual igual o mayor que Caution y menor que Danger. Aumentar la frecuencia de inspección y programar reparación.' },
  { s: 'critico' as const, t: 'L actual igual o mayor que Danger. Reparar antes de continuar operando.' },
  { s: 'ni' as const, t: 'No inspeccionado: acceso, limpieza deficiente o fuera de programación.' },
];

export function InspectionForm({ unitId }: { unitId: string }) {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const update = useStore((s) => s.update);
  const setAsOf = useStore((s) => s.setAsOf);
  const u = fleet.units.find((x) => x.unitId === unitId) ?? fleet.units[0];
  const [date, setDate] = useState(today());
  const estimate = useMemo(() => {
    if (!u?.nowHours || !u.nowDate || !u.usage) return '';
    return String(Math.round((u.nowHours + Math.max(daysBetween(u.nowDate, date), 0) * u.usage) * 10) / 10);
  }, [u, date]);
  const [hours, setHours] = useState('');
  const [inspector, setInspector] = useState('');
  const [notes, setNotes] = useState('');
  const [zoneNotes, setZoneNotes] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  if (!u)
    return (
      <div className="panel empty">
        No hay equipos cargados. <a href={href.datos()}>Cargue el Excel en Datos</a>.
      </div>
    );
  if (fleet.isPast)
    return (
      <div className="notice info">
        <div>
          Está viendo la plataforma como estaba el {fmtDate(fleet.asOf)}. Para registrar una inspección nueva,{' '}
          <button className="btn sm" onClick={() => setAsOf(null)}>
            vuelva al presente
          </button>
        </div>
      </div>
    );

  const inspectors = [...new Set(db.events.map((e) => e.inspector).filter(Boolean))].sort();
  const zones = db.zones.filter((z) => u.points.some((p) => p.point.zone === z.id));
  const row = (code: string): Row => rows[code] ?? { L: '', ni: false, rep: false, comment: '', files: [] };
  const setRow = (code: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [code]: { ...row(code), ...patch } }));
  const h = toNumber(hours || estimate);
  const lastH = u.nowHours ?? 0;

  // Validación
  const errors: string[] = [];
  if (!date) errors.push('Indique la fecha.');
  if (db.events.some((e) => e.unit === u.unitId && e.date === date)) errors.push(`Ya existe una inspección del ${fmtDate(date)} para ${u.unitId}. Cambie la fecha.`);
  if (u.nowDate && date < u.nowDate) errors.push(`La fecha es anterior a la última inspección (${fmtDate(u.nowDate)}).`);
  if (h == null) errors.push('Indique el horómetro.');
  else if (h < lastH) errors.push(`El horómetro (${fmt(h, 1)} h) es menor que el último registrado (${fmt(lastH, 1)} h). Revise el valor.`);
  else if (u.nowDate && daysBetween(u.nowDate, date) > 0 && (h - lastH) / daysBetween(u.nowDate, date) > 24)
    errors.push(`El horómetro implica más de 24 h por día desde la última inspección. Revise el valor.`);
  if (!inspector.trim()) errors.push('Indique el inspector.');
  const missing = u.points.filter((p) => {
    const r = row(p.point.code);
    return !r.ni && !r.rep && toNumber(r.L) == null;
  });
  if (missing.length) errors.push(`Falta L actual (o marcar N/I) en: ${missing.map((p) => p.point.code).join(', ')}.`);

  const save = async () => {
    setTried(true);
    if (errors.length) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const prefix = u.unitId.split('-')[0];
      const newInsp: Inspection[] = [];
      const newImages: string[] = [];
      for (const p of u.points) {
        const r = row(p.point.code);
        const photos: string[] = [];
        for (const [i, f] of r.files.entries()) {
          const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
          const name = `${prefix}_${p.point.code}_${date}${i ? '_' + (i + 1) : ''}.${ext}`;
          await saveImage(name, f);
          photos.push(name);
          newImages.push(name);
        }
        const L = r.ni ? null : r.rep ? 0 : toNumber(r.L);
        newInsp.push({
          id: `${u.unitId}|${p.point.code}|${date}`,
          unit: u.unitId,
          code: p.point.code,
          date,
          length: L,
          repaired: r.rep,
          comment: r.rep ? `Zona reparada por soldadura${r.comment ? '. ' + r.comment : ''}` : r.comment.trim(),
          image: photos[0] ?? zones.find((z) => z.id === p.point.zone)?.image ?? '',
          photos,
          excluded: false,
          flags: [],
          source: 'formulario',
        });
      }
      const ev: InspectionEvent = {
        id: `${u.unitId}|${date}`,
        unit: u.unitId,
        date,
        hours: h,
        inspector: inspector.trim(),
        notes: notes.trim(),
        zoneNotes,
        flags: [],
        source: 'formulario',
      };
      update((d) => ({
        ...d,
        events: [...d.events, ev].sort((a, b) => a.date.localeCompare(b.date)),
        inspections: [...d.inspections, ...newInsp],
      }));
      navigate(href.equipo(u.unitId));
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack insp-form">
      <div className="page-head">
        <div>
          <div className="crumbs no-print">
            <a href={href.flota()}>{db.fleet}</a>
            <span>/</span>
            <span>Registrar inspección</span>
          </div>
          <h1>Inspección estructural · {u.model}</h1>
          <p className="no-print">Réplica del formato de campo. Al guardar, la inspección se agrega al historial y todo se recalcula.</p>
        </div>
        <div className="row no-print">
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" />
            Imprimir formato
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar inspección'}
          </button>
        </div>
      </div>

      <Panel title="Encabezado">
        <div className="form-grid">
          <label className="f">
            Fecha
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="f">
            Equipo
            <select value={u.unitId} onChange={(e) => navigate(href.inspeccion(e.target.value))}>
              {fleet.units.map((x) => (
                <option key={x.unitId}>{x.unitId}</option>
              ))}
            </select>
          </label>
          <label className="f">
            Horas (horómetro)
            <input inputMode="decimal" placeholder={estimate ? `${estimate} (estimado)` : ''} value={hours} onChange={(e) => setHours(e.target.value)} />
            <span className="tiny muted">
              Última: {fmt(lastH, 1)} h el {fmtDate(u.nowDate)}. Estimado {estimate || '—'} h con {fmt(u.usage, 1)} h/día.
            </span>
          </label>
          <label className="f">
            Inspector
            <input list="inspectores" value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="INSP-01" />
            <datalist id="inspectores">
              {inspectors.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </label>
          <label className="f">
            Zonas
            <input value={`${zones.length} zonas · ${u.points.length} puntos`} disabled />
          </label>
        </div>
        <p className="tiny muted" style={{ margin: '10px 0 0' }}>
          NOTA: con el equipo armado algunas áreas quedan ocultas y no son inspeccionables. Lo reportado se refiere a las zonas con acceso.
        </p>
      </Panel>

      <div className="grid-2">
        <Panel title="Criterios">
          <table className="t">
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c.s}>
                  <td style={{ width: 120 }}>
                    <StatusPill status={c.s} />
                  </td>
                  <td className="small">{c.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Observaciones generales de la inspección">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} style={{ width: '100%' }} placeholder="Condiciones de la inspección, accesos, limpieza…" />
        </Panel>
      </div>

      {zones.map((z, zi) => {
        const zp = u.points.filter((p) => p.point.zone === z.id);
        return (
          <Panel key={z.id} title={`Zona ${zi + 1}: ${z.name}`} className="insp-zone" tight>
            <div className="table-wrap">
              <table className="t insp-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th className="r">C / D (mm)</th>
                    <th className="r">L anterior</th>
                    <th>L actual (mm)</th>
                    <th>Estado</th>
                    <th>N/I</th>
                    <th>Reparada</th>
                    <th>Comentario y fotos</th>
                  </tr>
                </thead>
                <tbody>
                  {zp.map((p) => {
                    const r = row(p.point.code);
                    const prev = [...p.series].reverse().find((s) => s.length != null);
                    const L = r.ni ? null : r.rep ? 0 : toNumber(r.L);
                    const st = r.ni ? 'ni' : L == null ? null : statusOf(L, p.point);
                    const drop = !r.rep && L != null && prev?.length != null && L < prev.length;
                    const miss = tried && !r.ni && !r.rep && L == null;
                    return (
                      <tr key={p.point.key}>
                        <td>
                          <div className="code">{p.point.code}</div>
                          <div className="tiny muted" style={{ maxWidth: 200 }}>
                            {p.point.description}
                          </div>
                        </td>
                        <td className="r tab">
                          {p.point.caution} / {p.point.danger}
                        </td>
                        <td className="r tab">{prev ? `${prev.length}` : '—'}</td>
                        <td>
                          <input
                            data-l={p.point.code}
                            inputMode="decimal"
                            value={r.rep ? '0' : r.ni ? '' : r.L}
                            disabled={r.ni || r.rep}
                            onChange={(e) => setRow(p.point.code, { L: e.target.value })}
                            aria-label={`L actual ${p.point.code}`}
                            aria-invalid={miss}
                            style={{ width: 90, textAlign: 'right', borderColor: miss ? 'var(--alerta)' : undefined }}
                          />
                        </td>
                        <td style={{ minWidth: 150 }}>
                          {r.rep ? <span className="st">Reparada</span> : st ? <StatusPill status={st} /> : <span className="muted">—</span>}
                          {st === 'critico' && <div className="tiny" style={{ color: 'var(--critico)', marginTop: 4, fontWeight: 600 }}>Reparar antes de continuar operando</div>}
                          {drop && (
                            <div className="tiny" style={{ color: 'var(--alerta)', marginTop: 4 }}>
                              Menor que la anterior ({prev!.length} mm) sin reparación: verifique.
                            </div>
                          )}
                        </td>
                        <td>
                          <input type="checkbox" checked={r.ni} onChange={(e) => setRow(p.point.code, { ni: e.target.checked, rep: false })} aria-label={`${p.point.code} no inspeccionado`} />
                        </td>
                        <td>
                          <input type="checkbox" checked={r.rep} onChange={(e) => setRow(p.point.code, { rep: e.target.checked, ni: false })} aria-label={`${p.point.code} reparada`} />
                        </td>
                        <td style={{ minWidth: 230 }}>
                          <input value={r.comment} onChange={(e) => setRow(p.point.code, { comment: e.target.value })} placeholder="Comentario" style={{ width: '100%' }} />
                          <label className="tiny muted no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, cursor: 'pointer' }}>
                            <Icon name="camera" size={13} />
                            {r.files.length ? `${r.files.length} foto(s)` : 'Agregar fotos'}
                            <input type="file" accept="image/*" multiple hidden onChange={(e) => setRow(p.point.code, { files: Array.from(e.target.files ?? []) })} />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid-2" style={{ padding: 18 }}>
              <div>
                <div className="small muted" style={{ marginBottom: 6 }}>
                  Ubicación de los puntos de inspección
                </div>
                <Schematic image={z.image} points={zp} />
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="small muted">Registro fotográfico</span>
                <div className="small">
                  {zp.flatMap((p) => row(p.point.code).files.map((f) => `${p.point.code}: ${f.name}`)).join(' · ') || <span className="muted">Sin fotos adjuntas.</span>}
                </div>
                <label className="f" style={{ marginTop: 8 }}>
                  Observaciones de la zona
                  <textarea value={zoneNotes[z.id] ?? ''} rows={4} onChange={(e) => setZoneNotes((n) => ({ ...n, [z.id]: e.target.value }))} />
                </label>
              </div>
            </div>
          </Panel>
        );
      })}

      {tried && errors.length > 0 && (
        <div className="notice alerta no-print">
          <div>
            <b>No se puede guardar todavía:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {saveErr && <div className="notice critico no-print">{saveErr}</div>}
      <div className="row no-print" style={{ justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar inspección'}
        </button>
      </div>
      <p className="tiny muted print-only">
        Criterios: {Object.values(STATUS_LABEL).join(' · ')}. Firma del inspector: ____________________
      </p>
    </div>
  );
}
