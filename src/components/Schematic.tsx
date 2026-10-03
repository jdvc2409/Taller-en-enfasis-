// Esquema real de la zona con los puntos como círculos de color según estado.
// El centro del círculo cae exactamente en la coordenada (fracción del ancho y alto de la imagen).
import { useRef, useState } from 'react';
import type { PointAnalysis } from '../lib/analysis';
import { STATUS_LABEL } from '../lib/analysis';
import { href, navigate } from '../router';
import { useImage } from '../store';
import { StatusIcon } from './ui';

interface Props {
  image: string;
  points: PointAnalysis[];
  selected?: string; // point key
  editing?: boolean;
  onMove?: (key: string, pos: { x: number; y: number }) => void;
  compact?: boolean;
}

export function Schematic({ image, points, selected, editing, onMove, compact }: Props) {
  const url = useImage(image);
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ key: string; x: number; y: number } | null>(null);

  if (!image) return <div className="empty">Esta zona no tiene esquema asignado. Asígnelo en Datos.</div>;
  if (!url) return <div className="empty">Falta la imagen "{image}". Súbala en Datos → Biblioteca de imágenes.</div>;

  const frac = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) };
  };
  const placed = points.filter((p) => p.point.pos2d);
  const missing = points.filter((p) => !p.point.pos2d);

  return (
    <div>
      <div
        ref={box}
        className={`schem${editing ? ' editing' : ''}`}
        onPointerMove={(e) => drag && setDrag({ ...drag, ...frac(e) })}
        onPointerUp={() => {
          if (drag) onMove?.(drag.key, { x: Math.round(drag.x * 1000) / 1000, y: Math.round(drag.y * 1000) / 1000 });
          setDrag(null);
        }}
        onPointerLeave={() => setDrag(null)}
        style={{ touchAction: editing ? 'none' : undefined }}
      >
        <img src={url} alt={`Esquema de la zona con ${points.length} puntos de inspección`} draggable={false} />
        {placed.map((p) => {
          const pos = drag?.key === p.point.key ? drag : p.point.pos2d!;
          const sel = p.point.key === selected;
          if (compact && !sel && selected) {
            return (
              <div key={p.point.key} className={`mk ${p.status}`} style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, opacity: 0.55 }}>
                <span className="mk-dot small">
                  <StatusIcon status={p.status} size={9} />
                </span>
              </div>
            );
          }
          return (
            <div
              key={p.point.key}
              className={`mk ${p.status}${sel ? ' sel' : ''}${pos.x > 0.82 ? ' left' : ''}`}
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            >
              <button
                className="mk-dot"
                style={{ padding: 0 }}
                aria-label={`${p.point.code}: ${STATUS_LABEL[p.status]}${p.length ? `, ${p.length} mm` : ''}`}
                title={`${p.point.code} · ${p.point.description}\n${STATUS_LABEL[p.status]}${p.length != null ? ` · ${p.length} mm` : ''}`}
                onPointerDown={(e) => {
                  if (!editing) return;
                  e.preventDefault();
                  setDrag({ key: p.point.key, ...frac(e) });
                }}
                onClick={() => !editing && navigate(href.punto(p.point.key))}
              >
                <StatusIcon status={p.status} size={sel ? 15 : 13} />
              </button>
              <span className="mk-lbl">
                {p.point.code}
                {p.length != null && p.length > 0 ? ` · ${p.length}` : ''}
              </span>
            </div>
          );
        })}
      </div>
      {missing.length > 0 && (
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>
          Sin ubicación en el esquema: {missing.map((p) => p.point.code).join(', ')}. Use "Mover puntos" para ubicarlos.
        </p>
      )}
    </div>
  );
}
