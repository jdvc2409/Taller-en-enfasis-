import { useMemo } from 'react';
import { useStore } from './store';
import { analyze } from './lib/analysis';

/** Análisis de toda la flota con el corte de la máquina del tiempo (memoizado por base y corte). */
export function useAnalysis() {
  const db = useStore((s) => s.db)!;
  const asOf = useStore((s) => s.asOf);
  return useMemo(() => analyze(db, asOf), [db, asOf]);
}
