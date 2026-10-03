import { useMemo, useState } from 'react';
import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href, navigate } from '../router';
import { exportWorkbook } from '../lib/importer';
import type { Status } from '../types';
import { Icon, Panel, Severity, StatusPill, fmt, fmtDate } from '../components/ui';

export function downloadBlob(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportExcel(db: Parameters<typeof exportWorkbook>[0]) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  downloadBlob(exportWorkbook(db) as Uint8Array<ArrayBuffer>, `historial_grietas_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

type StFilter = '' | Status | 'reparada';

export function History() {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const [unit, setUnit] = useState('');
  const [zone, setZone] = useState('');
  const [point, setPoint] = useState('');
  const [st, setSt] = useState<StFilter>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [onlyQ, setOnlyQ] = useState(false);
  const [limit, setLimit] = useState(150);

  const rows = useMemo(
    () =>
      fleet.points
        .flatMap((p) => p.series.map((s) => ({ p, s })))
        .sort((a, b) => b.s.date.localeCompare(a.s.date) || a.p.point.code.localeCompare(b.p.point.code)),
    [fleet],
  );
  const codes = [...new Set(fleet.points.filter((p) => (!unit || p.point.unit === unit) && (!zone || p.point.zone === zone)).map((p) => p.point.code))].sort();
  const filtered = rows.filter(({ p, s }) => {
    if (unit && p.point.unit !== unit) return false;
    if (zone && p.point.zone !== zone) return false;
    if (point && p.point.code !== point) return false;
    if (st === 'reparada' && !s.repaired) return false;
    if (st && st !== 'reparada' && (s.repaired || s.status !== st)) return false;
    if (from && s.date < from) return false;
    if (to && s.date > to) return false;
    if (onlyQ && !s.flags.length && !s.eventFlags.some((f) => f.severity !== 'info')) return false;
    return true;
  });
  const zoneName = (id: string) => db.zones.find((z) => z.id === id)?.name ?? id;
  const clear = () => {
    setUnit('');
    setZone('');
    setPoint('');
    setSt('');
    setFrom('');
    setTo('');
    setOnlyQ(false);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Historial de inspecciones</h1>
          <p>
            {rows.length} registros{fleet.isPast ? ` hasta el ${fmtDate(fleet.asOf)}` : ''}. Cada inspección nueva queda junto con las anteriores.
          </p>
        </div>
        <button className="btn" onClick={() => exportExcel(db)}>
          <Icon name="download" />
          Exportar Excel
        </button>
      </div>

      <Panel>
        <div className="filters">
          {fleet.units.length > 1 && (
            <label className="f">
              Equipo
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="">Todos</option>
                {fleet.units.map((u) => (
                  <option key={u.unitId}>{u.unitId}</option>
                ))}
              </select>
            </label>
          )}
          <label className="f">
            Zona
            <select value={zone} onChange={(e) => (setZone(e.target.value), setPoint(''))}>
              <option value="">Todas</option>
              {db.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <label className="f">
            Punto
            <select value={point} onChange={(e) => setPoint(e.target.value)}>
              <option value="">Todos</option>
              {codes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="f">
            Estado
            <select value={st} onChange={(e) => setSt(e.target.value as StFilter)}>
              <option value="">Todos</option>
              <option value="critico">Crítico</option>
              <option value="alerta">Alerta</option>
              <option value="normal">Normal</option>
              <option value="sin">Sin grieta</option>
              <option value="reparada">Reparada</option>
              <option value="ni">N/I</option>
            </select>
          </label>
          <label className="f">
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="f">
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="check" style={{ alignSelf: 'end', paddingBottom: 8 }}>
            <input type="checkbox" checked={onlyQ} onChange={(e) => setOnlyQ(e.target.checked)} />
            Solo con observaciones de calidad
          </label>
          <button className="btn ghost sm" style={{ alignSelf: 'end', marginBottom: 4 }} onClick={clear}>
            Limpiar filtros
          </button>
        </div>
      </Panel>

      <Panel title={`${filtered.length} registros`} tight>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Fecha</th>
                {fleet.units.length > 1 && <th>Equipo</th>}
                <th className="r">Horas</th>
                <th>Inspector</th>
                <th>Zona</th>
                <th>Punto</th>
                <th className="r">L (mm)</th>
                <th>Estado</th>
                <th>Comentario y calidad</th>
                <th className="r">Fila</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map(({ p, s }) => (
                <tr key={s.id} className="clickable" onClick={() => navigate(href.punto(p.point.key))}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</td>
                  {fleet.units.length > 1 && <td>{p.point.unit}</td>}
                  <td className="r">{fmt(s.hours, 1)}</td>
                  <td>{s.inspector}</td>
                  <td className="small">{zoneName(p.point.zone)}</td>
                  <td className="code">{p.point.code}</td>
                  <td className="r" style={{ fontWeight: 600 }}>
                    {s.length == null ? 'N/I' : fmt(s.length)}
                  </td>
                  <td>{s.repaired ? <span className="st" style={{ borderColor: 'var(--acento)' }}>Reparada</span> : <StatusPill status={s.status} />}</td>
                  <td className="small" style={{ minWidth: 240, maxWidth: 420 }}>
                    {s.comment && <div>"{s.comment}"</div>}
                    {s.flags.map((f, i) => (
                      <div key={i} className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start', color: 'var(--tinta2)' }}>
                        <Severity s={f.severity} />
                        <span>{f.message}</span>
                      </div>
                    ))}
                    {s.excluded && <div className="tiny muted">Excluida de la tendencia</div>}
                  </td>
                  <td className="r muted small">{s.row ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <button className="btn sm" onClick={() => setLimit((l) => l + 300)}>
              Mostrar más ({filtered.length - limit} restantes)
            </button>
          </div>
        )}
        {!filtered.length && <div className="empty">Ningún registro cumple los filtros.</div>}
      </Panel>
    </div>
  );
}
