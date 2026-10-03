// Modelo de datos de la plataforma. Todo lo que se persiste vive en `DB`.

export type Status = 'ni' | 'sin' | 'normal' | 'alerta' | 'critico';

export type Severity = 'info' | 'warn' | 'error';

export type FlagType =
  | 'atipico'
  | 'baja-leve'
  | 'baja'
  | 'salto'
  | 'repara-sin-grieta'
  | 'horometro'
  | 'intervalo'
  | 'parcial';

export interface Flag {
  type: FlagType;
  severity: Severity;
  message: string;
}

export interface Unit {
  id: string; // 631-01
  fleet: string; // Traílla 631G
  model: string; // CAT 631G
}

export interface Zone {
  id: string; // AP, BW, EY
  name: string; // Apron (compuerta delantera)
  criticality: number; // consecuencia C, 1..5
  reason: string;
  image: string; // nombre del esquema
  order: number;
}

export interface Point {
  key: string; // `${unit}|${code}`
  unit: string;
  code: string;
  zone: string; // Zone.id
  description: string;
  caution: number;
  danger: number;
  pos2d?: { x: number; y: number }; // fracción del ancho/alto del esquema
  /** Consecuencia propia del punto; si falta, se usa la de la zona. */
  criticality?: number;
  criticalityReason?: string;
}

export interface InspectionEvent {
  id: string; // `${unit}|${date}`
  unit: string;
  date: string; // aaaa-mm-dd
  hours: number | null;
  inspector: string;
  notes: string;
  zoneNotes: Record<string, string>;
  flags: Flag[];
  source: 'excel' | 'formulario' | 'ot';
}

export interface Inspection {
  id: string; // `${unit}|${code}|${date}`
  unit: string;
  code: string;
  date: string;
  length: number | null; // null = N/I
  repaired: boolean;
  comment: string;
  image: string; // columna Imagen del Excel
  photos: string[]; // nombres de imágenes asociadas
  excluded: boolean; // resultado final (automático + override)
  override?: 'include' | 'exclude';
  flags: Flag[];
  row?: number; // fila del Excel (1 = encabezado)
  source: 'excel' | 'formulario' | 'ot';
}

export type WOState = 'notificacion' | 'abierta' | 'planeada' | 'programada' | 'ejecutada' | 'cerrada';

export interface WOOperation {
  id: string;
  text: string;
  people: number;
  hours: number; // duración de la operación
}

export interface WOMaterial {
  id: string;
  text: string;
  qty: number;
  unit: string;
}

export interface WorkOrder {
  id: string; // OT-0001
  pointKey: string;
  state: WOState;
  history: { state: WOState; at: string }[]; // at = ISO datetime
  createdAt: string; // aaaa-mm-dd
  dueDate: string | null;
  scheduledDate: string | null;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  maintenanceType: string;
  notificationType: string;
  description: string;
  location: string;
  statusAtCreation: Status;
  lengthAtCreation: number | null;
  failureMode: string;
  mechanism: string;
  cause: string;
  detection: string;
  activity: string;
  operations: WOOperation[];
  materials: WOMaterial[];
  rate: number;
  /** Materiales, repuestos y otros gastos (USD). */
  otherCost?: number;
  report: string;
  closeDate: string | null;
  closeHours: number | null;
}

export interface Settings {
  fastGrowth: number; // mm por cada 100 h
  nearCaution: number; // fracción de Caution
  alertWindow: number; // h
  targetInterval: number; // h
  capacity: number; // h-hombre por semana
  rate: number; // USD/h
  aiModel: string;
}

export interface ImportLog {
  at: string;
  file: string;
  mode: 'agregar' | 'reemplazar' | 'inicial';
  added: number;
  skipped: number;
  warnings: string[];
}

export interface DB {
  version: number;
  fleet: string;
  units: Unit[];
  zones: Zone[];
  points: Point[];
  events: InspectionEvent[];
  inspections: Inspection[];
  workOrders: WorkOrder[];
  settings: Settings;
  imports: ImportLog[];
  images: string[]; // nombres de imágenes subidas por el usuario (guardadas en IndexedDB)
  pos3d: Record<string, [number, number, number]>;
}
