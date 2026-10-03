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
import { Icon, StatusPill, fmt, fmtDate } from '../components/ui';

interface Row {
  L: string;
  ni: boolean;
  rep: boolean;
  comment: string;
  files: File[];
}

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
  const [step, setStep] = useState(0);

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

  const headErrors = errors.filter((e) => !e.startsWith('Falta L'));
  const zoneMissing = (zid: string) => missing.filter((p) => p.point.zone === zid);
  const steps = [
    { t: 'Datos', ok: !headErrors.length },
    ...zones.map((z) => ({ t: z.name.split(' (')[0], ok: !zoneMissing(z.id).length })),
    { t: 'Revisar y guardar', ok: !errors.length },
  ];
  const last = steps.length - 1;
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(last, n)));
    window.scrollTo(0, 0);
  };

  const pointCard = (p: (typeof u.points)[number]) => {
    const r = row(p.point.code);
    const prev = [...p.series].reverse().find((s) => s.length != null);
    const L = r.ni ? null : r.rep ? 0 : toNumber(r.L);
    const st = r.ni ? 'ni' : L == null ? null : statusOf(L, p.point);
    const drop = !r.rep && L != null && prev?.length != null && L < prev.length;
    const miss = tried && !r.ni && !r.rep && L == null;
    const mode = r.ni ? 'ni' : r.rep ? 'rep' : 'med';
    return (
      <div key={p.point.key} className={`wz-pt${miss ? ' miss' : ''}`}>
        <div className="wz-pt-h">
          <div>
            <div className="code">{p.point.code}</div>
            <div className="small muted">{p.point.description}</div>
          </div>
          {r.rep ? <span className="st">Reparada</span> : st ? <StatusPill status={st} /> : null}
        </div>
        <div className="seg wz-mode" role="radiogroup" aria-label={`Resultado en ${p.point.code}`}>
          <button type="button" aria-pressed={mode === 'med'} onClick={() => setRow(p.point.code, { ni: false, rep: false })}>
            Medí
          </button>
          <button type="button" aria-pressed={mode === 'ni'} onClick={() => setRow(p.point.code, { ni: true, rep: false })}>
            No pude revisarlo
          </button>
          <button type="button" aria-pressed={mode === 'rep'} onClick={() => setRow(p.point.code, { rep: true, ni: false })}>
            Se reparó
          </button>
        </div>
        {mode === 'med' && (
          <label className="wz-l">
            <span>Largo de la grieta</span>
            <span className="wz-l-in">
              <input
                data-l={p.point.code}
                inputMode="decimal"
                value={r.L}
                placeholder="0"
                onChange={(e) => setRow(p.point.code, { L: e.target.value })}
                aria-label={`L actual ${p.point.code}`}
                aria-invalid={miss}
              />
              mm
            </span>
            <span className="tiny muted">
              Antes: {prev ? `${prev.length} mm` : '—'} · límite {p.point.danger} mm · 0 = sin grieta
            </span>
          </label>
        )}
        {miss && <div className="f-err">Escribe el largo, o elige “No pude revisarlo”.</div>}
        {st === 'critico' && <div className="f-err">Crítico: reparar antes de seguir operando.</div>}
        {drop && <div className="tiny" style={{ color: 'var(--alerta)' }}>Menor que la medida anterior ({prev!.length} mm) sin reparación: verifica.</div>}
        <details className="wz-more">
          <summary>{r.comment || r.files.length ? `Comentario${r.files.length ? ` · ${r.files.length} foto(s)` : ''}` : 'Agregar comentario o foto'}</summary>
          <input value={r.comment} onChange={(e) => setRow(p.point.code, { comment: e.target.value })} placeholder="Comentario" style={{ width: '100%' }} />
          <label className="btn sm" style={{ marginTop: 8 }}>
            <Icon name="camera" size={14} />
            {r.files.length ? `${r.files.length} foto(s)` : 'Agregar fotos'}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => setRow(p.point.code, { files: Array.from(e.target.files ?? []) })} />
          </label>
        </details>
      </div>
    );
  };

  const counts = u.points.reduce<Record<string, number>>((a, p) => {
    const r = row(p.point.code);
    const L = r.ni ? null : r.rep ? 0 : toNumber(r.L);
    const k = r.rep ? 'rep' : r.ni ? 'ni' : L == null ? 'falta' : statusOf(L, p.point);
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});

  return (
    <div className="stack insp-form">
      <div className="page-head">
        <div>
          <h1>Registrar inspección</h1>
          <p className="no-print">
            {u.unitId} · {u.model}
          </p>
        </div>
        <button className="btn ghost no-print" onClick={() => window.print()}>
          <Icon name="print" />
          Imprimir formato
        </button>
      </div>

      <ol className="wz-steps no-print">
        {steps.map((s, i) => (
          <li key={s.t} className={i === step ? 'on' : s.ok && i < step ? 'done' : ''}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="wz-n">{s.ok && i !== step && i < last ? '✓' : i + 1}</span>
              <span>{s.t}</span>
            </button>
          </li>
        ))}
      </ol>

      <section className={`panel${step === 0 ? '' : ' wz-hide'}`}>
        <div className="panel-h">
          <h2>1. Datos de la inspección</h2>
        </div>
        <div className="panel-b form-grid">
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
            Horómetro (h)
            <input inputMode="decimal" placeholder={estimate ? `${estimate} (estimado)` : ''} value={hours} onChange={(e) => setHours(e.target.value)} />
            <span className="f-hint">Última: {fmt(lastH, 1)} h</span>
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
        </div>
        {tried && headErrors.length > 0 && step === 0 && (
          <div className="panel-b" style={{ paddingTop: 0 }}>
            {headErrors.map((e) => (
              <div key={e} className="f-err">
                {e}
              </div>
            ))}
          </div>
        )}
      </section>

      {zones.map((z, zi) => {
        const zp = u.points.filter((p) => p.point.zone === z.id);
        return (
          <section key={z.id} className={`panel insp-zone${step === zi + 1 ? '' : ' wz-hide'}`}>
            <div className="panel-h">
              <div>
                <h2>
                  {zi + 2}. {z.name}
                </h2>
                <p>{zp.length} puntos. Mide cada grieta y escribe su largo.</p>
              </div>
            </div>
            <div className="panel-b wz-zone">
              <div className="wz-pts">{zp.map(pointCard)}</div>
              <div className="wz-side">
                <Schematic image={z.image} points={zp} />
                <label className="f" style={{ marginTop: 12 }}>
                  Observaciones de la zona (opcional)
                  <textarea value={zoneNotes[z.id] ?? ''} rows={3} onChange={(e) => setZoneNotes((n) => ({ ...n, [z.id]: e.target.value }))} />
                </label>
              </div>
            </div>
          </section>
        );
      })}

      <section className={`panel no-print${step === last ? '' : ' wz-hide'}`}>
        <div className="panel-h">
          <h2>{last + 1}. Revisar y guardar</h2>
        </div>
        <div className="panel-b stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            {(['critico', 'alerta', 'normal', 'sin', 'ni'] as const).map((k) =>
              counts[k] ? (
                <StatusPill key={k} status={k} label={`${counts[k]} ${STATUS_LABEL[k]}`} />
              ) : null,
            )}
            {counts.rep ? <span className="st">{counts.rep} reparada(s)</span> : null}
            {counts.falta ? <span className="st st-sin">{counts.falta} sin dato</span> : null}
          </div>
          {errors.length > 0 ? (
            <div className="notice alerta">
              <StatusIconSmall />
              <div>
                <b>Falta completar:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="notice normal">
              <StatusIconSmall ok />
              <div>
                <b>Todo listo.</b> {fmtDate(date)} · {fmt(h, 1)} h · {inspector}
              </div>
            </div>
          )}
          <label className="f">
            Observaciones generales (opcional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Condiciones, accesos, limpieza…" />
          </label>
          {saveErr && <div className="notice critico">{saveErr}</div>}
        </div>
      </section>

      <div className="wz-nav no-print">
        <button className="btn" onClick={() => go(step - 1)} disabled={step === 0}>
          <Icon name="left" />
          Atrás
        </button>
        <span className="small muted">
          Paso {step + 1} de {steps.length}
        </span>
        {step < last ? (
          <button className="btn primary" onClick={() => go(step + 1)}>
            Siguiente
            <Icon name="right" />
          </button>
        ) : (
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar inspección'}
          </button>
        )}
      </div>
      <p className="tiny muted print-only">
        Criterios: {Object.values(STATUS_LABEL).join(' · ')}. Firma del inspector: ____________________
      </p>
    </div>
  );
}

function StatusIconSmall({ ok }: { ok?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 12 12" aria-hidden="true">
      {ok ? <circle cx="6" cy="6" r="5" fill="var(--normal)" /> : <path d="M6 0.8 11.4 10.6H0.6Z" fill="var(--alerta)" />}
    </svg>
  );
}
