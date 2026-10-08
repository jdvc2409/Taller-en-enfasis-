// Botón flotante "Pregúntale a la IA". Es liviano: el panel del chat se carga aparte la primera vez que se abre
// y queda montado (oculto) para conservar la conversación mientras la página siga abierta.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useRoute } from '../router';
import { Icon } from './ui';

const ChatPanel = lazy(() => import('./ChatPanel'));

export function ChatBot() {
  const db = useStore((s) => s.db);
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Al cerrar el panel, el foco vuelve al botón.
  useEffect(() => {
    if (wasOpen.current && !open) fab.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!db) return null;
  const close = () => setOpen(false);

  return (
    <>
      {!open && (
        <button
          ref={fab}
          className={`chat-fab no-print${route.name === 'inspeccion' ? ' alto' : ''}`}
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
          aria-label="Pregúntale a la IA"
          aria-haspopup="dialog"
        >
          <Icon name="spark" size={18} />
          <span className="chat-fab-t">Pregúntale a la IA</span>
        </button>
      )}
      {loaded && (
        <Suspense fallback={open ? <div className="chat-panel chat-loading">Cargando…</div> : null}>
          <ChatPanel open={open} onClose={close} route={route} />
        </Suspense>
      )}
    </>
  );
}
