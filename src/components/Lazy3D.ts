import { lazy } from 'react';

// El 3D se carga aparte para no frenar la primera visita.
export const Scraper3D = lazy(() => import('./Scraper3D'));
