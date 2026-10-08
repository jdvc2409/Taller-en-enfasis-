// Panel del chatbot: conversación con streaming sobre los datos de la plataforma y el material del curso.
// Solo lee el análisis (useAnalysis, con la máquina del tiempo); no crea ni modifica nada.
// La conversación vive solo en memoria: no va a IndexedDB, al respaldo JSON ni a la exportación de Excel.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAnalysis } from '../hooks';
import { useStore } from '../store';
import { href, type Route } from '../router';
import { SYSTEM, aiAvailable, aiErrorMessage, askClaude } from '../lib/ai';
import { CHAT_MAX_TOKENS, chatDataContext, chatPrompt, suggestions, transcript, type ChatTurn } from '../lib/chat';
import { AI_MODELS } from '../lib/catalog';
import { Markdown } from './AIPanel';
import { Icon, fmtDate } from './ui';

interface Item {
  id: number;
  kind: 'user' | 'assistant' | 'aviso';
  text: string;
  /** La respuesta aún está llegando. */
  pending?: boolean;
}

let nextId = 1;

/** Consulta en curso. */
interface Running {
  ac: AbortController;
  uid: number;
  aid: number;
  question: string;
  received: string;
}

function chatError(e: unknown) {
  const err = e as { status?: number };
  if (err?.status === 429) return 'Se alcanzó el límite de consultas de la plataforma (25 cada 10 minutos). Espere unos minutos.';
  return aiErrorMessage(e);
}

export default function ChatPanel({ open, onClose, route }: { open: boolean; onClose: () => void; route: Route }) {
  const fleet = useAnalysis();
  const db = useStore((s) => s.db)!;
  const apiKey = useStore((s) => s.apiKey);
  const model = db.settings.aiModel;
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState('');
  const [copied, setCopied] = useState<number | 'todo' | null>(null);
  const active = useRef<Running | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const canAsk = aiAvailable(apiKey);

  // Foco al cuadro de texto al abrir; Esc cierra.
  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => () => active.current?.ac.abort(), []);

  // Si cambia la fecha de corte con la conversación empezada, se avisa dentro de la conversación.
  const corte = fleet.isPast ? fleet.asOf : null;
  const prevCorte = useRef(corte);
  useEffect(() => {
    if (prevCorte.current === corte) return;
    prevCorte.current = corte;
    setItems((it) =>
      it.some((x) => x.kind !== 'aviso')
        ? [...it, { id: nextId++, kind: 'aviso', text: corte ? `Desde aquí respondo con los datos al ${fmtDate(corte)}.` : 'Desde aquí respondo con los datos de hoy.' }]
        : it,
    );
  }, [corte]);

  // Autodesplazamiento al último mensaje, salvo que la persona haya subido a leer.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items, open]);
  const onScroll = () => {
    const el = list.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const history = (): ChatTurn[] =>
    items.filter((x) => x.kind !== 'aviso' && !x.pending && x.text).map((x) => ({ role: x.kind as ChatTurn['role'], text: x.text }));

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy || !canAsk) return;
    const { screen, dataContext } = chatDataContext(db, fleet, route);
    const text = chatPrompt({ dataContext, screen, history: history(), question: q });
    setLastSent(`${SYSTEM}\n\n---\n\n${text}`);
    const ac = new AbortController();
    const uid = nextId++;
    const aid = nextId++;
    const run: Running = { ac, uid, aid, question: q, received: '' };
    active.current = run;
    stick.current = true;
    setItems((it) => [...it, { id: uid, kind: 'user', text: q }, { id: aid, kind: 'assistant', text: '', pending: true }]);
    setInput('');
    setErr(null);
    setBusy(true);
    try {
      await askClaude({
        apiKey,
        model,
        text,
        maxTokens: CHAT_MAX_TOKENS,
        signal: ac.signal,
        onText: (d) => {
          if (active.current !== run) return;
          run.received += d;
          patchItem(aid, (x) => ({ ...x, text: x.text + d }));
        },
      });
      if (active.current !== run) return; // ya se detuvo o se empezó una conversación nueva
      patchItem(aid, (x) => ({ ...x, pending: false }));
      finish();
    } catch (e) {
      if (active.current !== run) return;
      drop(run);
      setErr(chatError(e));
    }
  };

  const patchItem = (id: number, f: (x: Item) => Item) => setItems((it) => it.map((x) => (x.id === id ? f(x) : x)));
  const finish = () => {
    active.current = null;
    setBusy(false);
  };
  /** Quita el intercambio sin respuesta y devuelve la pregunta al cuadro. */
  const drop = (run: Running) => {
    setItems((it) => it.filter((x) => x.id !== run.uid && x.id !== run.aid));
    setInput((cur) => cur || run.question);
    finish();
  };
  /** "Detener": la pantalla se actualiza de inmediato, sin esperar a que el SDK cierre la conexión. */
  const stop = () => {
    const run = active.current;
    if (!run) return;
    run.ac.abort();
    if (run.received) {
      patchItem(run.aid, (x) => ({ ...x, text: x.text + '\n\n_(Respuesta detenida.)_', pending: false }));
      finish();
    } else drop(run);
  };

  const reset = () => {
    active.current?.ac.abort();
    finish();
    setItems([]);
    setErr(null);
    setInput('');
    setLastSent('');
    box.current?.focus();
  };

  const copy = async (text: string, what: number | 'todo') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setErr('El navegador no permitió copiar. Seleccione el texto y cópielo a mano.');
    }
  };

  const modelName = AI_MODELS.find((m) => m.id === model)?.name ?? model;
  const started = items.some((x) => x.kind !== 'aviso');

  return (
    <aside className="chat-panel" role="dialog" aria-modal="false" aria-label="Pregúntale a la IA" hidden={!open}>
      <div className="chat-head">
        <div className="chat-title">
          <h2>Pregúntale a la IA</h2>
          <div className="tiny muted">Conoce el historial del equipo {fleet.units.map((u) => u.unitId).join(', ')} y el material del curso</div>
          {canAsk && <div className="tiny muted">{modelName}{apiKey ? ' · clave propia' : ''}</div>}
        </div>
        <div className="row chat-actions">
          <button className="btn sm" onClick={reset} disabled={!started && !input} aria-label="Nueva conversación">
            <Icon name="plus" size={14} />
            Nueva<span className="chat-largo"> conversación</span>
          </button>
          <details className="chat-menu">
            <summary className="btn sm ghost" aria-label="Más opciones">
              Más
            </summary>
            <div className="chat-menu-pop">
              <button className="btn sm ghost" onClick={() => copy(transcript(history()), 'todo')} disabled={!history().length}>
                <Icon name="copy" size={14} />
                {copied === 'todo' ? 'Copiada' : 'Copiar conversación'}
              </button>
            </div>
          </details>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </div>
      </div>

      {fleet.isPast && (
        <div className="chat-corte" role="status">
          Respondo con los datos al <b>{fmtDate(fleet.asOf)}</b>. Lo medido después no lo conozco.
        </div>
      )}

      <div className="chat-list" ref={list} onScroll={onScroll}>
        {!canAsk ? (
          <div className="notice info">
            <div>
              La IA no está disponible en esta página. Agregue una clave propia en{' '}
              <a href={href.datos()} onClick={onClose}>
                Datos → IA
              </a>{' '}
              (se guarda solo en este navegador).
            </div>
          </div>
        ) : !started ? (
          <div className="chat-empty">
            <p className="muted small">Pregunte por el estado de la traílla, qué reparar primero o un tema del curso. Por ejemplo:</p>
            <div className="chat-chips">
              {suggestions(db, fleet, route).map((s) => (
                <button key={s} className="chat-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {items.map((x) =>
          x.kind === 'aviso' ? (
            <div key={x.id} className="chat-aviso">
              {x.text}
            </div>
          ) : x.kind === 'user' ? (
            <div key={x.id} className="chat-msg yo">
              <span className="sr-only">Tú: </span>
              {x.text}
            </div>
          ) : (
            <div key={x.id} className="chat-msg ia">
              <div className="md" aria-live={x.pending ? 'polite' : undefined} aria-busy={x.pending || undefined}>
                <span className="sr-only">IA: </span>
                {x.text ? <Markdown text={x.text} /> : <span className="muted small">Revisando los datos…</span>}
              </div>
              {!x.pending && x.text && (
                <button className="btn sm ghost chat-copy" onClick={() => copy(x.text, x.id)}>
                  <Icon name="copy" size={13} />
                  {copied === x.id ? 'Copiado' : 'Copiar'}
                </button>
              )}
            </div>
          ),
        )}
        {err && (
          <div className="notice critico" role="alert">
            <div>{err}</div>
          </div>
        )}
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={box}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Escriba su pregunta (Enter envía; Shift + Enter, nueva línea)"
          aria-label="Pregunta para la IA"
          disabled={!canAsk}
        />
        {/* Claves distintas: si se reutilizara el mismo botón, el clic en Detener terminaría enviando el formulario. */}
        {busy ? (
          <button key="detener" type="button" className="btn" onClick={stop}>
            Detener
          </button>
        ) : (
          <button key="enviar" type="submit" className="btn primary" disabled={!canAsk || !input.trim()}>
            Enviar
          </button>
        )}
      </form>

      <div className="chat-foot">
        <span className="tiny muted">Generado por IA: verifique cifras antes de actuar. La decisión es del ingeniero responsable.</span>
        <details className="ai-sent">
          <summary>Ver la información que se envía</summary>
          <pre>{lastSent || 'Todavía no se ha enviado ninguna pregunta. Cada pregunta lleva las instrucciones del chat, las reglas de cálculo, el material del curso, los datos de la plataforma, la conversación previa y la pregunta nueva.'}</pre>
        </details>
      </div>
    </aside>
  );
}
