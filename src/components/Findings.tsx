import type { Finding } from '../lib/analysis';
import { Severity } from './ui';

/** Hallazgos: solo el título a la vista; el detalle se abre al hacer clic. */
export function Findings({ items, limit }: { items: Finding[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) return <div className="empty">Sin hallazgos para esta fecha.</div>;
  return (
    <div>
      {list.map((f) => (
        <details key={f.id} className="finding">
          <summary>
            <Severity s={f.severity} />
            <h4>{f.title}</h4>
          </summary>
          <p>{f.text}</p>
        </details>
      ))}
    </div>
  );
}
