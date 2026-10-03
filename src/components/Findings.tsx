import type { Finding } from '../lib/analysis';
import { Severity } from './ui';

export function Findings({ items, limit }: { items: Finding[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) return <div className="empty">Sin hallazgos para esta fecha.</div>;
  return (
    <div>
      {list.map((f) => (
        <div key={f.id} className="finding">
          <Severity s={f.severity} />
          <div>
            <h4>{f.title}</h4>
            <p>{f.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
