// Movimiento de la interfaz: aparición escalonada al hacer scroll y contadores que suben hasta su valor.
// Todo se apaga si la persona pidió reducir el movimiento en su sistema.
import { useEffect, useRef, useState } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const REVEAL = '.panel, .kpi, .task, .verdict, .wz-pt, .kcol, .finding, .legend-row, .zone-chip';

/** Observa `root` y hace aparecer, en cascada, cada bloque cuando entra en pantalla. */
export function useReveal(root: React.RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    const el = root.current;
    if (!el || reduced() || !('IntersectionObserver' in window)) return;
    let batch = 0;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const t = e.target as HTMLElement;
          t.style.transitionDelay = `${Math.min(batch++, 8) * 55}ms`;
          t.classList.add('rv-in');
          io.unobserve(t);
          setTimeout(() => (t.style.transitionDelay = ''), 1200);
        }
        clearTimeout(batchTimer);
        batchTimer = setTimeout(() => (batch = 0), 120);
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    );
    const scan = () =>
      el.querySelectorAll<HTMLElement>(REVEAL).forEach((n) => {
        if (n.dataset.rv) return;
        n.dataset.rv = '1';
        n.classList.add('rv');
        io.observe(n);
      });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      clearTimeout(batchTimer);
    };
  }, [root, key]);
}

/** Número que sube desde 0 hasta su valor (formato es-CO: 1.234,5). */
export function CountUp({ text }: { text: string }) {
  const target = parseFloat(text.replace(/\./g, '').replace(',', '.'));
  const decimals = text.includes(',') ? text.split(',')[1].length : 0;
  const [v, setV] = useState(() => (reduced() ? target : 0));
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reduced() || !isFinite(target)) return setV(target);
    let raf = 0;
    let start = 0;
    const run = (t: number) => {
      if (!start) start = t;
      const k = Math.min(1, (t - start) / 1100);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(run);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        raf = requestAnimationFrame(run);
        io.disconnect();
      }
    });
    if (ref.current) io.observe(ref.current);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [target]);
  return (
    <span ref={ref}>
      {isFinite(target) ? v.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : text}
    </span>
  );
}

export const isCountable = (x: unknown): x is string | number => (typeof x === 'number' && isFinite(x)) || (typeof x === 'string' && /^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(x));
