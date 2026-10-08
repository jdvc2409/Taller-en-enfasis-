// Respuesta falsa de la IA para las pruebas de navegador: intercepta el intermediario (y la API directa)
// y responde un stream SSE con el formato de la API de Messages, sin gastar consultas.
import type { BrowserContext, Page } from 'playwright';

export interface IAFalsa {
  /** Cuerpos JSON enviados, en orden. */
  bodies: Record<string, unknown>[];
}

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export function streamFalso(text: string, model = 'claude-opus-5-5') {
  const parts = text.match(/[\s\S]{1,24}/g) ?? [''];
  return [
    sse('message_start', {
      type: 'message_start',
      message: { id: 'msg_prueba', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } },
    }),
    sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    ...parts.map((t) => sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })),
    sse('content_block_stop', { type: 'content_block_stop', index: 0 }),
    sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: parts.length } }),
    sse('message_stop', { type: 'message_stop' }),
  ].join('');
}

/**
 * Intercepta las consultas de IA. `responder` decide el texto según la pregunta; `retraso` (ms) demora la respuesta
 * para poder probar "Detener".
 */
export async function interceptarIA(target: Page | BrowserContext, responder: (pregunta: string) => string, retraso: (pregunta: string) => number = () => 0): Promise<IAFalsa> {
  const state: IAFalsa = { bodies: [] };
  const handler = async (route: import('playwright').Route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.bodies.push(body);
    const msgs = body.messages as { content: { type: string; text?: string }[] }[];
    const text = msgs?.[0]?.content?.find((c) => c.type === 'text')?.text ?? '';
    const m = text.match(/<pregunta_nueva>\n([\s\S]*?)\n<\/pregunta_nueva>/);
    const wait = retraso(m ? m[1] : text);
    if (wait) await new Promise((r) => setTimeout(r, wait));
    await route
      .fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: streamFalso(responder(m ? m[1] : text)) })
      .catch(() => {}); // la consulta pudo cancelarse con "Detener"
  };
  await target.route('**/integridad-estructural-ia.vercel.app/**', handler);
  await target.route('**/api.anthropic.com/**', handler);
  return state;
}
