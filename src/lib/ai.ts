// IA dentro de la plataforma: arma el contexto con cifras reales y llama a Claude desde el navegador.
// La clave la pega el usuario en Datos y queda solo en este navegador; nunca va en el código ni en el respaldo.
import type Anthropic from '@anthropic-ai/sdk';
import type { FleetAnalysis, PointAnalysis, UnitAnalysis } from './analysis';
import { STATUS_LABEL, fmtH } from './analysis';
import { stateLabel } from './ot';
import { AI_PROXY } from './catalog';

/** Hay IA disponible: con clave propia o con el intermediario de la plataforma. */
export const aiAvailable = (apiKey: string) => !!apiKey || !!AI_PROXY;
import type { DB } from '../types';

export const SYSTEM = `Eres un ingeniero de confiabilidad experto en integridad estructural de equipo minero (traíllas, cajas, compuertas y eyectores soldados).
Conoces el criterio del formato de inspección: Normal (L < Caution, seguimiento en la frecuencia normal), Alerta (Caution ≤ L < Danger, aumentar la frecuencia de inspección y programar reparación), Crítico (L ≥ Danger, reparar antes de continuar operando) y N/I (no inspeccionado por acceso, limpieza o programación; un N/I no es un punto sano).
Usas el vocabulario del curso de Gestión del Mantenimiento: mantenimiento preventivo basado en condición vs. correctivo (diferido / inmediato), planeación ("¿qué?") vs. programación ("¿cuándo?"), ciclo de la OT (Notificación → Aprobación / OT abierta → Planeación → Programación → Ejecución → Reporte → Cierre), MTBF, backlog, criticidad (probabilidad × consecuencia), análisis de causa raíz, mantenimiento proactivo e ISO 14224.
Los datos vienen de campo y pueden tener errores: señálalos cuando los veas.
Reglas de seguridad que no se negocian:
- Nunca recomiendes operar con un punto Crítico, fracturado o "posible crítico no verificado". Mientras exista uno, la respuesta a "¿puede operar el equipo?" es NO.
- Una medida dudosa que indique peor condición se trata como real hasta verificarla en campo. Nunca bajes el estado ni la prioridad que calculó la plataforma; puedes proponer subirlos.
- No presentes procedimientos de soldadura como aprobados: remite a la WPS calificada y al fabricante. Eres apoyo; la decisión es del ingeniero responsable.
Responde en español, en Markdown breve, con cifras, fechas y horas concretas y una decisión clara. Usa las fechas que trae la información; no calcules fechas propias. No inventes datos: si algo no está en la información recibida, dilo. Prioriza la seguridad de las personas sobre la producción.`;

const n = (x: number | null | undefined, d = 0) => (x == null || !isFinite(x) ? '—' : x.toLocaleString('es-CO', { maximumFractionDigits: d }));

function eta(label: string, c: PointAnalysis['toDanger'], passed: boolean) {
  if (passed) return `${label}: ya superado`;
  if (c.central == null && c.pessimistic == null) return `${label}: sin cruce en 15.000 h`;
  return `${label}: pesimista ${n(c.pessimistic)} h (${c.datePess ?? '—'}), central ${n(c.central)} h (${c.date ?? '—'}), optimista ${c.optimistic == null ? '> 15.000' : n(c.optimistic)} h (${c.dateOpt ?? '—'})`;
}

function pointLine(p: PointAnalysis) {
  const marks = [
    p.fractured && 'FRACTURA o grieta pasante reportada',
    p.unverified && 'POSIBLE CRÍTICO NO VERIFICADO',
    p.lastNI && 'no medido en la última inspección',
    p.rcaRequired && 'requiere análisis de causa raíz',
  ].filter(Boolean);
  return `- ${p.point.code} (${p.point.description}; zona ${p.zone.name}; C ${p.point.caution} / D ${p.point.danger} mm; consecuencia ${p.consequence}): ${STATUS_LABEL[p.status]}, L = ${p.length ?? 'N/I'} mm (medida ${p.lastDate ?? '—'}), ${p.priority} (${p.priorityWhy}).${marks.length ? ' Marcas: ' + marks.join('; ') + '.' : ''} Pronóstico ${p.fit.model}, confianza ${p.fit.confidence}, ritmo ${p.rate == null ? '—' : n(p.rate, 1) + ' mm/100 h'}. ${eta('Danger', p.toDanger, p.status === 'critico')}. ${eta('Caution', p.toCaution, p.status === 'alerta' || p.status === 'critico')}. Reparaciones ${p.kpis.repairs}. Acción: ${p.action}${p.statusNote ? ' Nota: ' + p.statusNote : ''}`;
}

function historyLines(p: PointAnalysis) {
  return p.series
    .map(
      (s) =>
        `  ${s.date} | ${s.hours == null ? '—' : n(s.hours, 1)} h | ${s.length == null ? 'N/I' : s.length + ' mm'}${s.repaired ? ' | REPARADA' : ''}${s.excluded ? ' | excluida de la tendencia' : ''}${s.comment ? ` | "${s.comment}"` : ''}${s.flags.length ? ' | ' + s.flags.map((f) => f.type).join(', ') : ''}`,
    )
    .join('\n');
}

export function unitContext(db: DB, fleet: FleetAnalysis, u: UnitAnalysis) {
  const corte = fleet.isPast ? `Fecha de corte (máquina del tiempo): ${fleet.asOf}. Solo cuentan los datos hasta esa fecha.\n` : '';
  const wos = fleet.workOrders.filter((w) => w.pointKey.startsWith(u.unitId + '|'));
  return `${corte}EQUIPO ${u.unitId} (${u.model}, flota ${db.fleet})
Horómetro actual ${n(u.nowHours, 1)} h${u.nowEstimated ? ' (estimado)' : ''} al ${u.nowDate}; uso promedio ${n(u.usage, 1)} h/día; uso para convertir horas a fechas ${n(u.usageForecast, 1)} h/día; ${u.events.length} inspecciones desde ${u.firstDate}.

INDICADORES
- Puntos: Crítico ${u.counts.critico}, Alerta ${u.counts.alerta}, Normal ${u.counts.normal}, Sin grieta ${u.counts.sin}, N/I ${u.counts.ni}.
- Reparaciones ${u.repairs}; "MTBF estructural" del encargo = horas observadas / reparaciones = ${n(u.mtbf)} h (en rigor es un tiempo medio entre reparaciones). Fallas (episodios sobre Danger o fractura) ${u.failures}; MTBF de falla (definición del curso) ${n(u.mtbfFailure)} h.
- Horas operando con al menos un punto crítico: ${n(u.hoursWithCriticalConfirmed)} h confirmadas, hasta ${n(u.hoursWithCritical)} h (hasta la reparación o el corte).
- Inspecciones a tiempo (≤ ${db.settings.targetInterval} h): ${u.onTimeCount[0]} de ${u.onTimeCount[1]} (${n((u.onTimePct ?? 0) * 100)} %). Celdas N/I: ${u.niCells}. Ritmo típico de crecimiento ${n(u.typicalRate, 1)} mm/100 h.
- OT: ${fleet.backlog.open} abiertas, backlog ${n(fleet.backlog.hh, 1)} h-hombre = ${n(fleet.backlog.weeks, 1)} semanas (capacidad ${db.settings.capacity} h-h/semana).

PUNTOS
${u.points.map(pointLine).join('\n')}

HALLAZGOS AUTOMÁTICOS
${u.findings.map((f) => `- [${f.severity}] ${f.title}: ${f.text}`).join('\n') || '- Ninguno'}

INSPECCIONES (fecha | horas | desde la anterior | marcas)
${u.events
  .map(
    (e) =>
      `- ${e.event.date} | ${e.event.hours == null ? '—' : n(e.event.hours, 1)} h | ${e.sinceDays ?? '—'} días, ${e.sinceHours == null ? '—' : fmtH(e.sinceHours)} h | ${e.event.inspector}${e.event.flags.length ? ' | ' + e.event.flags.map((f) => f.message).join(' ') : ''}`,
  )
  .join('\n')}

ÓRDENES DE TRABAJO
${wos.map((w) => `- ${w.id} ${w.pointKey.split('|')[1]} ${w.priority} ${stateLabel(w.state)} (creada ${w.createdAt}, límite ${w.dueDate ?? '—'})`).join('\n') || '- Ninguna'}

HISTORIAL DETALLADO POR PUNTO (fecha | horas | L | marcas)
${u.points.map((p) => `${p.point.code}:\n${historyLines(p)}`).join('\n')}`;
}

export function reportPrompt(ctx: string) {
  return `${ctx}

Con esta información, escribe el INFORME EJECUTIVO del equipo para el jefe de mantenimiento:
1. **Estado en 3 líneas.**
2. **Decisiones de esta semana:** ¿puede operar el equipo? Qué reparar, qué programar y qué reinspeccionar, con plazos en horas y fechas.
3. **Riesgos y patrones**, con hipótesis de causa raíz.
4. **Fallas de gestión observadas** (intervalos, inspecciones parciales, operación sobre Danger) y cómo evitarlas.
5. **Calidad de datos:** qué medidas o registros revisar.
6. **Tres recomendaciones proactivas.**`;
}

export function pointPrompt(db: DB, fleet: FleetAnalysis, p: PointAnalysis) {
  const u = fleet.units.find((x) => x.unitId === p.point.unit)!;
  const corte = fleet.isPast ? `Fecha de corte (máquina del tiempo): ${fleet.asOf}.\n` : '';
  return `${corte}PUNTO ${p.point.code} del equipo ${p.point.unit} (${u.model}), horómetro actual ${n(u.nowHours, 1)} h al ${u.nowDate}, uso para fechas ${n(u.usageForecast, 1)} h/día.
${pointLine(p)}
Método del pronóstico: ${p.fit.note}
Confianza: ${p.fit.confidence}. Próxima inspección: ${p.nextInspection == null ? 'reparar antes de operar' : '≤ ' + n(p.nextInspection) + ' h'}.
Indicadores: ${p.kpis.repairs} reparaciones; reaparece tras reparar en ${n(p.kpis.reappearMean)} h de media; vida de la grieta ${n(p.kpis.lifeMean)} h; horas sobre Danger ${n(p.kpis.dangerConfirmed)} confirmadas, hasta ${n(p.kpis.dangerMax)} (cota superior ${n(p.kpis.dangerUpper)}).
Alertas: ${p.alerts.map((a) => a.text).join(' ') || 'ninguna'}
Ritmo típico del equipo: ${n(u.typicalRate, 1)} mm/100 h. Criterios: crecimiento rápido ≥ ${db.settings.fastGrowth} mm/100 h; intervalo objetivo ${db.settings.targetInterval} h.

HISTORIAL (fecha | horas | L | marcas)
${historyLines(p)}

Escribe el DIAGNÓSTICO de este punto:
1. **¿Qué tan confiable es la tendencia?** (número de medidas, ajuste, datos dudosos).
2. **¿Cuándo intervenir y con qué tipo de mantenimiento?** (correctivo inmediato o diferido, preventivo basado en condición), con horas y fecha.
3. **¿Qué causa raíz es probable?**
4. **¿Cómo evitar que reincida?**
Termina con una línea: **Recomendación:** …`;
}

export function photoPrompt(p: PointAnalysis, photoName: string, date: string | null, L: number | null) {
  return `Foto "${photoName}" del punto ${p.point.code} (${p.point.description}; Caution ${p.point.caution} mm, Danger ${p.point.danger} mm), tomada ${date ?? 'en fecha desconocida'}. Medida registrada ese día: ${L == null ? 'N/I' : L + ' mm'}. Estado actual del punto: ${STATUS_LABEL[p.status]}.

Analiza la imagen:
1. Describe la indicación visible (ubicación, orientación, si sale de una soldadura o de un borde).
2. ¿Parece una grieta pasante o una fractura?
3. ¿Es coherente con la medida registrada?
4. ¿Qué verificar en campo (END, limpieza, medición)?
Si la foto no permite concluir, dilo claramente y explica por qué.
La foto no sustituye el END. Si sugiere una grieta pasante o una fractura no registrada, recomienda tratar el punto como Crítico hasta verificarlo. Nunca concluyas que la grieta es menor que la medida registrada solo por la foto.`;
}

/** Reduce la imagen a máx. 1568 px por lado y la devuelve en JPEG base64 (sin el prefijo data:). */
export async function blobToBase64(blob: Blob, max = 1568): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.88).split(',')[1];
}

export interface AskOptions {
  /** Clave propia del usuario; si está vacía se usa el intermediario de la plataforma. */
  apiKey: string;
  model: string;
  text: string;
  imageB64?: string;
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}

/** Llama a Claude con streaming. Devuelve el texto completo. */
export async function askClaude({ apiKey, model, text, imageB64, onText, signal }: AskOptions): Promise<string> {
  // El SDK se carga solo cuando se usa la IA, para no frenar la primera visita.
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
  const client = apiKey
    ? new AnthropicSDK({ apiKey, dangerouslyAllowBrowser: true })
    : new AnthropicSDK({ apiKey: 'intermediario', baseURL: AI_PROXY, dangerouslyAllowBrowser: true, maxRetries: 1 });
  if (!apiKey && !AI_PROXY) throw new Error('La IA de la plataforma no está configurada. Agregue una clave propia en Datos → IA.');
  const content: Anthropic.ContentBlockParam[] = [];
  if (imageB64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } });
  content.push({ type: 'text', text });
  const stream = client.messages.stream(
    {
      model,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      // Haiku 4.5 no admite el parámetro effort; en los demás se fija explícitamente.
      ...(model.startsWith('claude-haiku') ? {} : { output_config: { effort: 'medium' as const } }),
    },
    { signal },
  );
  if (onText) stream.on('text', onText);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') {
    throw new Error('El modelo declinó responder esta solicitud. Revise el contenido enviado o pruebe otro modelo.');
  }
  const out = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return msg.stop_reason === 'max_tokens' ? out + '\n\n_(Respuesta cortada por longitud.)_' : out;
}

/** Mensaje de error entendible para la persona. */
export function aiErrorMessage(e: unknown): string {
  // Errores tipados del SDK (se leen por nombre y estado porque el SDK se carga de forma diferida).
  const err = e as { name?: string; status?: number; message?: string };
  if (err?.name === 'AbortError' || err?.name === 'APIUserAbortError') return 'Solicitud cancelada.';
  if (err?.status === 401) return 'La clave de API no es válida. Revísela en Datos → IA.';
  if (err?.status === 403) return 'La clave no tiene permiso para este modelo. Pruebe otro modelo en Datos → IA.';
  if (err?.status === 404) return 'El modelo elegido no existe para esta clave. Elija otro en Datos → IA.';
  if (err?.status === 429) return 'Se alcanzó el límite de consultas. Espere unos minutos y use "Regenerar".';
  if (err?.status === 403 && /origen/i.test(err.message ?? '')) return 'Esta página no está autorizada para usar la IA de la plataforma.';
  if (err?.name === 'APIConnectionError' || err?.name === 'APIConnectionTimeoutError')
    return 'No hay conexión con la API de Anthropic. Revise internet o use "Copiar para pegar en Claude".';
  if (typeof err?.status === 'number') return `La API respondió con error ${err.status}: ${err.message ?? ''}`;
  return e instanceof Error ? e.message : String(e);
}
