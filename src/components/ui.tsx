// Piezas pequeñas de interfaz compartidas por todas las vistas.
import type { ReactNode } from 'react';
import type { Status } from '../types';
import { STATUS_LABEL } from '../lib/analysis';

export const STATUS_COLOR: Record<Status, string> = {
  critico: 'var(--critico)',
  alerta: 'var(--alerta)',
  normal: 'var(--normal)',
  sin: 'var(--sin)',
  ni: 'var(--ni)',
};

/** Forma por estado: círculo lleno = Normal, triángulo = Alerta, rombo con "!" = Crítico, círculo hueco = Sin grieta, punteado = N/I. */
export function StatusIcon({ status, size = 12 }: { status: Status; size?: number }) {
  const c = STATUS_COLOR[status];
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      {status === 'normal' && <circle cx="6" cy="6" r="5" fill={c} />}
      {status === 'alerta' && <path d="M6 0.8 11.4 10.6H0.6Z" fill={c} />}
      {status === 'critico' && (
        <>
          <path d="M6 0.3 11.7 6 6 11.7 0.3 6Z" fill={c} />
          <rect x="5.25" y="2.9" width="1.5" height="4.2" rx=".4" fill="var(--sobre-critico)" />
          <rect x="5.25" y="7.9" width="1.5" height="1.5" rx=".4" fill="var(--sobre-critico)" />
        </>
      )}
      {status === 'sin' && <circle cx="6" cy="6" r="4.4" fill="none" stroke={c} strokeWidth="1.6" />}
      {status === 'ni' && <circle cx="6" cy="6" r="4.4" fill="none" stroke="var(--apagado)" strokeWidth="1.4" strokeDasharray="1.8 1.6" />}
    </svg>
  );
}

export function StatusPill({ status, big, label }: { status: Status; big?: boolean; label?: string }) {
  return (
    <span className={`st st-${status}${big ? ' big' : ''}`}>
      <StatusIcon status={status} size={big ? 14 : 12} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

export function Prio({ p, title }: { p: 'P1' | 'P2' | 'P3' | 'P4'; title?: string }) {
  return (
    <span className={`prio prio-${p}`} title={title}>
      {p}
    </span>
  );
}

/** Barra L frente a Caution y Danger. La escala llega a 1,25 × Danger (o a L si es mayor). */
export function LimitBar({ L, caution, danger, status, width }: { L: number | null; caution: number; danger: number; status: Status; width?: number }) {
  const max = Math.max(danger * 1.25, (L ?? 0) * 1.05, 1);
  const pct = (v: number) => `${Math.min((v / max) * 100, 100)}%`;
  return (
    <div className="lbar" style={{ width }} role="img" aria-label={`${L ?? 'N/I'} mm; Caution ${caution}, Danger ${danger}`}>
      <div className="lbar-zone" style={{ left: pct(caution), width: `calc(${pct(danger)} - ${pct(caution)})`, background: 'var(--alerta-fondo)' }} />
      <div className="lbar-zone" style={{ left: pct(danger), right: 0, background: 'var(--critico-fondo)' }} />
      {L != null && L > 0 && <div className="lbar-fill" style={{ width: pct(L), background: STATUS_COLOR[status] }} />}
      <div className="lbar-tick" style={{ left: pct(caution), background: 'var(--alerta)' }} />
      <div className="lbar-tick" style={{ left: pct(danger), background: 'var(--critico)' }} />
    </div>
  );
}

export function Panel({
  title,
  sub,
  actions,
  children,
  tight,
  className,
  id,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tight?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel ${className ?? ''}`} id={id}>
      {(title || actions) && (
        <div className="panel-h">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`panel-b${tight ? ' tight' : ''}`}>{children}</div>
    </section>
  );
}

export interface KPIItem {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: 'critico' | 'alerta';
  title?: string;
}

export function KPIs({ items }: { items: KPIItem[] }) {
  return (
    <div className="kpis">
      {items.map((k, i) => (
        <div key={i} className={`kpi${k.tone ? ' is-' + k.tone : ''}`} title={k.title}>
          <div className="kpi-l">{k.label}</div>
          <div className="kpi-v">
            {k.value}
            {k.unit && <small>{k.unit}</small>}
          </div>
          {k.sub && <div className="kpi-s">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Severity({ s }: { s: 'error' | 'warn' | 'info' }) {
  return <span className={`sev sev-${s}`} aria-label={s === 'error' ? 'grave' : s === 'warn' ? 'advertencia' : 'informativo'} />;
}

// ---------------------------------------------------------------- formato

export const fmt = (n: number | null | undefined, d = 0) =>
  n == null || !isFinite(n) ? '—' : n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d });

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${MESES[m - 1]} ${y}`;
};
export const fmtDateShort = (d: string) => {
  const [y, m] = d.split('-');
  return `${y.slice(2)}/${m}`;
};
/** ≥ 1000 como 1.1k */
export const fmtMM = (n: number | null) => (n == null ? '' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

export function Icon({ name, size = 16 }: { name: 'sun' | 'moon' | 'left' | 'right' | 'back' | 'print' | 'copy' | 'refresh' | 'spark' | 'x' | 'plus' | 'download' | 'upload' | 'move' | 'camera'; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      {name === 'sun' && (
        <g {...p}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      )}
      {name === 'moon' && <path {...p} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
      {name === 'left' && <path {...p} d="M15 6l-6 6 6 6" />}
      {name === 'right' && <path {...p} d="M9 6l6 6-6 6" />}
      {name === 'back' && <path {...p} d="M4 12h12M4 12l5-5M4 12l5 5M20 5v14" />}
      {name === 'print' && (
        <g {...p}>
          <path d="M7 9V3h10v6M7 17H4v-7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7h-3" />
          <path d="M7 14h10v7H7z" />
        </g>
      )}
      {name === 'copy' && (
        <g {...p}>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
        </g>
      )}
      {name === 'refresh' && <path {...p} d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />}
      {name === 'spark' && <path {...p} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />}
      {name === 'x' && <path {...p} d="M6 6l12 12M18 6L6 18" />}
      {name === 'plus' && <path {...p} d="M12 5v14M5 12h14" />}
      {name === 'download' && <path {...p} d="M12 4v11M7 10l5 5 5-5M5 20h14" />}
      {name === 'upload' && <path {...p} d="M12 20V9M7 14l5-5 5 5M5 4h14" />}
      {name === 'move' && <path {...p} d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />}
      {name === 'camera' && (
        <g {...p}>
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </g>
      )}
    </svg>
  );
}

/** Logo: perfil de una traílla sobre una línea de plano, con una grieta. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--acento)" />
      <path d="M6 20h4l3-8h12v8h-3" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="10.5" cy="22.5" r="2.5" fill="#fff" />
      <circle cx="22.5" cy="22.5" r="2.5" fill="#fff" />
      <path d="M17 12l1.2 3-1.6 1.6 1.2 2.4" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
