// Intermediario de IA para la plataforma Integridad Estructural.
// Guarda la clave de Anthropic como secreto del servidor (ANTHROPIC_API_KEY) y reenvía solo
// las consultas de la plataforma: modelos permitidos, mensaje de sistema propio, tamaño y frecuencia limitados.
import { SYSTEM } from '../../lib/system.js';

const ORIGINS = ['https://jdvc2409.github.io', 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:4180'];
const MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const MAX_BODY = 4_000_000; // texto + una imagen de 1568 px en JPEG
const MAX_TOKENS = 16000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 25; // consultas por IP cada 10 minutos (por instancia)
const hits = new Map<string, number[]>();

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') ?? 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function error(req: Request, status: number, message: string) {
  return new Response(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message } }), {
    status,
    headers: { 'content-type': 'application/json', ...cors(req) },
  });
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  if (!ORIGINS.includes(origin)) return error(req, 403, 'Origen no permitido.');
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return error(req, 500, 'El servidor no tiene configurada la clave de IA.');

  const ip = (req.headers.get('x-forwarded-for') ?? 'desconocida').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return error(req, 429, 'Demasiadas consultas seguidas. Espere unos minutos.');
  recent.push(now);
  hits.set(ip, recent);

  const text = await req.text();
  if (text.length > MAX_BODY) return error(req, 413, 'La consulta es demasiado grande.');
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return error(req, 400, 'Consulta inválida.');
  }
  const model = String(body.model ?? '');
  if (!MODELS.has(model)) return error(req, 400, `Modelo no permitido: ${model}.`);
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length !== 1 || (messages[0] as { role?: string }).role !== 'user') {
    return error(req, 400, 'La plataforma envía una sola pregunta por consulta.');
  }
  const clean: Record<string, unknown> = {
    model,
    max_tokens: Math.min(Number(body.max_tokens) || 2000, MAX_TOKENS),
    system: SYSTEM,
    messages,
    stream: body.stream === true,
  };
  if (body.output_config && !model.startsWith('claude-haiku')) clean.output_config = { effort: 'medium' };

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(clean),
    signal: req.signal,
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
      ...cors(req),
    },
  });
}
