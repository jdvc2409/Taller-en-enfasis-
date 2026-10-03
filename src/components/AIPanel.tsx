// Panel lateral de IA: informe ejecutivo, diagnóstico de un punto y análisis de foto.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnalysis } from '../hooks';
import { imageBlob, useStore } from '../store';
import { href } from '../router';
import { SYSTEM, aiAvailable, aiErrorMessage, askClaude, blobToBase64, photoPrompt, pointPrompt, reportPrompt, unitContext } from '../lib/ai';
import { AI_MODELS } from '../lib/catalog';
import { Icon } from './ui';

export type AIKind = 'informe' | 'diagnostico' | 'foto';

interface Props {
  kind: AIKind;
  unitId?: string;
  pointKey?: string;
  photo?: { name: string; date: string | null; length: number | null };
  label?: string;
  small?: boolean;
}

const TITLES: Record<AIKind, string> = {
  informe: 'Informe ejecutivo con IA',
  diagnostico: 'Diagnóstico con IA',
  foto: 'Análisis de foto con IA',
};

export function AIButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn${props.small ? ' sm' : ''}`} onClick={() => setOpen(true)}>
        <Icon name="spark" />
        {props.label ?? TITLES[props.kind]}
      </button>
      {open && createPortal(<AIPanel {...props} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function AIPanel({ kind, unitId, pointKey, photo, onClose }: Props & { onClose: () => void }) {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const apiKey = useStore((s) => s.apiKey);
  const model = db.settings.aiModel;
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const prompt = useMemo(() => {
    if (kind === 'informe') {
      const u = fleet.units.find((x) => x.unitId === unitId) ?? fleet.units[0];
      return reportPrompt(unitContext(db, fleet, u));
    }
    const p = fleet.points.find((x) => x.point.key === pointKey)!;
    if (kind === 'diagnostico') return pointPrompt(db, fleet, p);
    return photoPrompt(p, photo!.name, photo!.date, photo!.length);
  }, [kind, unitId, pointKey, photo, db, fleet]);

  const canAsk = aiAvailable(apiKey);
  const run = async () => {
    if (!canAsk) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    setErr(null);
    setOut('');
    try {
      let imageB64: string | undefined;
      if (kind === 'foto' && photo) {
        const blob = await imageBlob(photo.name);
        if (!blob) throw new Error(`No encontré la imagen "${photo.name}". Súbala en Datos → Biblioteca de imágenes.`);
        imageB64 = await blobToBase64(blob);
      }
      await askClaude({ apiKey, model, text: prompt, imageB64, signal: ac.signal, onText: (d) => setOut((o) => o + d) });
    } catch (e) {
      if (!ac.signal.aborted) setErr(aiErrorMessage(e));
    } finally {
      if (abort.current === ac) setBusy(false);
    }
  };

  useEffect(() => {
    closeRef.current?.focus();
    if (canAsk) run();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      abort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setErr('El navegador no permitió copiar. Seleccione el texto y cópielo a mano.');
    }
  };
  const fullMessage = `${SYSTEM}\n\n---\n\n${prompt}`;
  const modelName = AI_MODELS.find((m) => m.id === model)?.name ?? model;

  return (
    <div className="ai-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="ai-panel" role="dialog" aria-modal="true" aria-label={TITLES[kind]}>
        <div className="ai-head">
          <div>
            <h2>{TITLES[kind]}</h2>
            <div className="tiny muted">
              {canAsk ? `${modelName}${apiKey ? ' · clave propia' : ''}` : 'IA no configurada'}
              {fleet.isPast ? ` · corte ${fleet.asOf}` : ''}
            </div>
          </div>
          <button ref={closeRef} className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </div>
        <div className="ai-body">
          {!canAsk ? (
            <div className="stack" style={{ gap: 12 }}>
              <div className="notice info">
                <div>
                  No hay clave de API configurada. Copie el mensaje completo y péguelo en <b>claude.ai</b>
                  {kind === 'foto' ? ' junto con la foto' : ''}, o agregue su clave en{' '}
                  <a href={href.datos()} onClick={onClose}>
                    Datos → IA
                  </a>{' '}
                  (se guarda solo en este navegador).
                </div>
              </div>
              <button className="btn primary" onClick={() => copy(fullMessage, 'mensaje')}>
                <Icon name="copy" />
                {copied === 'mensaje' ? 'Copiado' : 'Copiar para pegar en Claude'}
              </button>
            </div>
          ) : (
            <>
              {err && (
                <div className="notice critico" style={{ marginBottom: 12 }}>
                  <div>{err}</div>
                </div>
              )}
              {busy && !out && <div className="muted small ai-wait">Analizando los datos…</div>}
              {out && (
                <div className="md" id="ai-output">
                  <Markdown text={out} />
                </div>
              )}
            </>
          )}
          <details className="ai-sent">
            <summary>Ver la información que se envía</summary>
            <pre>{fullMessage}</pre>
          </details>
        </div>
        <div className="ai-foot">
          <span className="tiny muted">Generado por IA: verifique cifras antes de actuar.</span>
          {canAsk && (
            <div className="row" style={{ gap: 6 }}>
              {busy ? (
                <button className="btn sm" onClick={() => abort.current?.abort()}>
                  Detener
                </button>
              ) : (
                <button className="btn sm" onClick={run}>
                  <Icon name="refresh" size={14} />
                  Regenerar
                </button>
              )}
              <button className="btn sm" onClick={() => copy(out, 'resultado')} disabled={!out}>
                <Icon name="copy" size={14} />
                {copied === 'resultado' ? 'Copiado' : 'Copiar resultado'}
              </button>
              <button className="btn sm ghost" onClick={() => copy(fullMessage, 'mensaje')} title="Copiar el mensaje completo para pegarlo en claude.ai">
                {copied === 'mensaje' ? 'Copiado' : 'Copiar para Claude'}
              </button>
              <button className="btn sm" onClick={() => printOutput(TITLES[kind])} disabled={!out || busy}>
                <Icon name="print" size={14} />
                Imprimir
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function printOutput(title: string) {
  const el = document.getElementById('ai-output');
  if (!el) return;
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return;
  w.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>body{font:11pt/1.5 Barlow,system-ui,sans-serif;max-width:720px;margin:32px auto;color:#111}h1,h2,h3{font-family:'Barlow Condensed',sans-serif}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}.n{color:#555;font-size:9pt;border-top:1px solid #999;margin-top:24px;padding-top:8px}</style></head><body><h1>${title}</h1>${el.innerHTML}<p class="n">Generado por IA en la plataforma Integridad Estructural. Verifique cifras antes de actuar.</p></body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}

// ---------------------------------------------------------------- Markdown mínimo (sin HTML: todo se escapa)

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const lvl = Math.min(h[1].length + 1, 4);
      const Tag = `h${lvl}` as 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={k++}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push(
        <div className="table-wrap" key={k++}>
          <table className="t">
            <thead>
              <tr>{rows[0]?.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d+[.)]/.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        i++;
      }
      const L = ordered ? 'ol' : 'ul';
      blocks.push(
        <L key={k++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </L>,
      );
      continue;
    }
    if (/^-{3,}$/.test(l.trim())) {
      blocks.push(<hr key={k++} />);
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*([-*•]|\d+[.)])\s+)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={k++}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <>{blocks}</>;
}
