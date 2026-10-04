// Valores de referencia de la flota 631G: posiciones de los puntos, criticidad de zonas e imágenes incluidas.
import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  fastGrowth: 15,
  nearCaution: 0.8,
  alertWindow: 600,
  targetInterval: 700,
  capacity: 96,
  rate: 45,
  aiModel: 'claude-opus-5-5',
};

/**
 * Intermediario de IA (función en Vercel que guarda la clave como secreto del servidor).
 * Con él, cualquier persona puede usar la IA desde el link sin pegar una clave. Es una URL pública, no un secreto.
 */
export const AI_PROXY = 'https://integridad-estructural-ia.vercel.app/api';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (más capaz)' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5 (equilibrado)' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (rápido)' },
];

/** Criticidad (consecuencia C) por defecto según el prefijo de la zona. */
export const ZONE_DEFAULTS: Record<string, { criticality: number; reason: string; order: number }> = {
  BW: { criticality: 5, reason: 'Estructura portante: una falla compromete la caja y la carga completa.', order: 1 },
  EY: { criticality: 3, reason: 'Afecta la productividad (descarga), con bajo riesgo para las personas.', order: 2 },
  AP: {
    criticality: 4,
    reason: 'La oreja de levante o el pivote pueden dejar caer la compuerta: riesgo de seguridad.',
    order: 3,
  },
};

/**
 * Puntos cuya consecuencia supera la de su zona. La oreja de levante y el pivote sostienen la compuerta:
 * su falla puede dejarla caer sobre una persona (riesgo de seguridad, C = 5).
 */
export const POINT_CRITICALITY: Record<string, { criticality: number; reason: string }> = {
  'AP-01': { criticality: 5, reason: 'Pivote del apron: su falla puede dejar caer la compuerta (seguridad).' },
  'AP-03': { criticality: 5, reason: 'Oreja de levante del apron: su falla puede dejar caer la compuerta (seguridad).' },
};

/** Posición de cada punto sobre su esquema (fracción del ancho y alto, en la punta de la flecha). */
export const POS2D: Record<string, { x: number; y: number }> = {
  'BW-01': { x: 0.075, y: 0.247 },
  'BW-02': { x: 0.607, y: 0.4 },
  'BW-03': { x: 0.768, y: 0.505 },
  'BW-04': { x: 0.393, y: 0.784 },
  'EY-01': { x: 0.382, y: 0.226 },
  'EY-02': { x: 0.429, y: 0.372 },
  'EY-03': { x: 0.279, y: 0.635 },
  'EY-04': { x: 0.529, y: 0.523 },
  'AP-01': { x: 0.491, y: 0.306 },
  'AP-02': { x: 0.559, y: 0.248 },
  'AP-03': { x: 0.704, y: 0.463 },
  'AP-04': { x: 0.6, y: 0.516 },
};

/** Posición 3D de cada punto sobre el modelo de la 631G (m; x adelante, y arriba, z derecha; eje delantero x = 4,40). */
export const POS3D: Record<string, [number, number, number]> = {
  'BW-01': [0.8, 2.2, -1.9],
  'BW-02': [-0.6, 2.56, 0],
  'BW-03': [-1.4, 1.45, 1.66],
  'BW-04': [-1.6, 0.82, -1.92],
  'EY-01': [-2.24, 1.85, 0.45],
  'EY-02': [-2.42, 1.0, -0.85],
  'EY-03': [-3.35, 1.1, 0.85],
  'EY-04': [-2.5, 1.86, 0],
  'AP-01': [-0.5, 1.75, -2.08],
  'AP-02': [0.55, 1.25, -1.82],
  'AP-03': [0.98, 2.1, 0],
  'AP-04': [1.18, 0.78, 0.35],
};

/** Imágenes que vienen con la aplicación (carpeta public/data). */
export const BUNDLED_IMAGES: Record<string, string> = {
  '631_BW_caja_bowl.png': 'data/esquemas/631_BW_caja_bowl.png',
  '631_EY_eyector.png': 'data/esquemas/631_EY_eyector.png',
  '631_AP_apron.png': 'data/esquemas/631_AP_apron.png',
  '631_AP-03_2026-02-05.jpg': 'data/fotos/631_AP-03_2026-02-05.jpg',
};

export const BUNDLED_EXCEL = 'data/631G_historial_grietas.xlsx';
