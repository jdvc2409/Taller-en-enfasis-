// Prueba de flujo en el navegador: OT completa, máquina del tiempo, inspección de prueba con el asistente
// paso a paso, restauración y chatbot (con la respuesta de la IA interceptada: no gasta consultas).
// Uso: npx tsx tools/flujo.ts [url-base]
import type { Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { abrirNavegador } from './navegador';
import { interceptarIA } from './ia-falsa';

const base = process.argv[2] ?? 'http://localhost:5173/';
mkdirSync('capturas', { recursive: true });
const browser = await abrirNavegador();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
let fails = 0;
const check = (name: string, ok: boolean, got = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '  ok ' : ' FALLA'}  ${name}${got ? '  →  ' + got : ''}`);
};
const go = async (p: Page, hash: string) => {
  await p.goto(base + hash);
  await p.waitForSelector('.page > *:not(.loading)');
  await p.waitForTimeout(300);
};

// 1. OT: crear → avanzar → cerrar con reparación
await go(page, '#/punto/631-01%7CAP-03');
await page.getByRole('button', { name: 'Crear orden de trabajo' }).click();
await page.waitForURL(/#\/ot\/OT-0001/);
check('Se crea OT-0001 desde AP-03', true);
const txt = await page.locator('.wo-doc').innerText();
check('Tipo: Correctivo inmediato', txt.includes('Correctivo inmediato') || (await page.locator('select').first().inputValue()) === 'Correctivo inmediato');
check('Modo de falla BRD (fractura)', (await page.locator('select').nth(2).inputValue()).startsWith('BRD'), await page.locator('select').nth(2).inputValue());
for (const st of ['OT abierta', 'Planeada', 'Programada', 'Ejecutada']) {
  await page.getByRole('button', { name: `Pasar a ${st}` }).click();
  await page.waitForTimeout(150);
}
await page.getByRole('button', { name: 'Reportar y cerrar' }).click();
await page.getByPlaceholder(/Qué se hizo/).fill('Reparación por soldadura con placa de refuerzo. END final MT sin indicaciones.');
await page.getByRole('button', { name: 'Cerrar OT' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'capturas/flujo-ot-cerrada.png', fullPage: true });
await go(page, '#/punto/631-01%7CAP-03');
const head = await page.locator('h1').innerText();
check('AP-03 queda Sin grieta', head.includes('Sin grieta'), head.replace(/\n/g, ' '));
const reps = await page.locator('.kv dt:has-text("Reparaciones") + dd').innerText();
check('AP-03 con una reparación más (2)', reps.trim() === '2', reps);
await go(page, '#/ot');
check('Kanban: OT en Cerrada', (await page.locator('.kcol').nth(5).innerText()).includes('OT-0001'));

// 2. Máquina del tiempo en 2024-04-30 sobre AP-03
await go(page, '#/punto/631-01%7CAP-03?corte=2024-04-30');
const tm = await page.locator('.tm').innerText();
check('Banda "Viendo la plataforma como estaba el 30 abr 2024"', tm.includes('30 abr 2024'), tm.split('\n')[1]);
const h1 = await page.locator('h1').innerText();
check('AP-03 en Alerta, P1 al corte', h1.includes('Alerta') && h1.includes('P1'), h1.replace(/\n/g, ' '));
const figs = await page.locator('.kpis').first().innerText();
check('Danger en 325 h (115 – 551)', figs.includes('325') && figs.includes('115') && figs.includes('551'), figs.replace(/\n/g, ' '));
check('Botón Crear OT oculto en el pasado', (await page.getByRole('button', { name: 'Crear orden de trabajo' }).count()) === 0);
await page.getByRole('button', { name: 'Volver a hoy' }).click();
await page.waitForTimeout(200);
check('Volver a hoy', !(await page.locator('.tm').innerText()).includes('Estás viendo'));

// 3. Inspección de prueba con el asistente (Datos → Caja → Eyector → Apron → Revisar y guardar) y restauración
await go(page, '#/inspeccion/631-01');
const pasos = (await page.locator('.wz-steps li').allInnerTexts()).map((t) => t.replace(/^\S+\s+/, '').trim());
check('Pasos del asistente', pasos.join(' → ') === 'Datos → Caja → Eyector → Apron → Revisar y guardar', pasos.join(' → '));
await page.locator('input[type=date]').first().fill('2026-10-20');
await page.getByPlaceholder('INSP-01').fill('INSP-PRUEBA');
const siguiente = () => page.locator('.wz-nav').getByRole('button', { name: 'Siguiente' }).click();
await siguiente();
const especiales: Record<string, 'No pude revisarlo' | 'Se reparó' | string> = { 'EY-01': 'No pude revisarlo', 'BW-02': 'Se reparó', 'AP-02': '120' };
for (let z = 0; z < 3; z++) {
  const tarjetas = page.locator('.insp-zone:not(.wz-hide) [role=radiogroup]');
  const n = await tarjetas.count();
  for (let i = 0; i < n; i++) {
    const code = ((await tarjetas.nth(i).getAttribute('aria-label')) ?? '').replace('Resultado en ', '');
    const e = especiales[code];
    if (e === 'No pude revisarlo' || e === 'Se reparó') await tarjetas.nth(i).getByRole('button', { name: e }).click();
    else {
      await tarjetas.nth(i).getByRole('button', { name: 'Medí' }).click();
      await page.locator(`input[data-l="${code}"]`).fill(e ?? '0');
    }
  }
  check(`Paso ${z + 2}: ${n} puntos con resultado`, n === 4, String(n));
  await siguiente();
}
await page.screenshot({ path: 'capturas/flujo-inspeccion-revisar.png', fullPage: true });
await page.locator('.wz-nav').getByRole('button', { name: 'Guardar inspección' }).click();
await page.waitForURL(/#\/equipo\/631-01/);
check('Guardar inspección lleva al equipo', true);
await go(page, '#/punto/631-01%7CAP-02');
const h = await page.locator('h1').innerText();
check('Inspección de prueba: AP-02 = 120 mm Normal', h.includes('Normal'), h.replace(/\n/g, ' '));
await go(page, '#/punto/631-01%7CEY-01');
check('EY-01 quedó N/I en la última inspección', (await page.locator('body').innerText()).includes('N/I'));
await go(page, '#/datos');
await page.getByRole('button', { name: 'Restaurar datos originales' }).click();
await page.waitForTimeout(800);
await go(page, '#/punto/631-01%7CAP-03');
const h2 = await page.locator('h1').innerText();
check('Restaurar: AP-03 vuelve a Crítico', h2.includes('Crítico'), h2.replace(/\n/g, ' '));
await go(page, '#/ot');
check('Restaurar: sin OT creadas', !(await page.locator('body').innerText()).includes('OT-0001'));

// 4. Chatbot (respuesta interceptada)
const ia = await interceptarIA(page, (q) => (/operar/i.test(q) ? '**No.** AP-03 está Crítico (400 mm) con fractura reportada: el equipo no debe operar hasta repararlo.' : 'Respuesta de prueba.'), (q) => (q.includes('lenta') ? 5000 : 0));
await go(page, '#/');
const fab = page.getByRole('button', { name: 'Pregúntale a la IA' });
await fab.click();
const panel = page.getByRole('dialog', { name: 'Pregúntale a la IA' });
await panel.waitFor();
check('Chatbot: foco en el cuadro de texto', await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'));
check('Chatbot: sugerencias en la conversación vacía', (await panel.locator('.chat-chip').count()) >= 4);
await panel.locator('textarea').fill('¿Puede operar hoy el equipo?');
await page.keyboard.press('Enter');
await panel.locator('.chat-copy').first().waitFor();
check('Chatbot: responde con streaming', (await panel.locator('.chat-msg.ia').innerText()).includes('no debe operar'));
const cuerpo = ia.bodies[0] as { messages: { role: string }[]; max_tokens: number };
check('Chatbot: un solo mensaje user por consulta', cuerpo.messages.length === 1 && cuerpo.messages[0].role === 'user', JSON.stringify(cuerpo.messages.map((m) => m.role)));
await page.keyboard.press('Escape');
await panel.waitFor({ state: 'hidden' });
check('Chatbot: Esc cierra y el foco vuelve al botón', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Pregúntale a la IA'));
await fab.click();
check('Chatbot: conserva la conversación al reabrir', (await panel.locator('.chat-msg').count()) === 2);
await panel.locator('textarea').fill('Pregunta lenta');
await page.keyboard.press('Enter');
await panel.getByRole('button', { name: 'Detener' }).click();
await page.waitForTimeout(300);
const tv = await panel.locator('textarea').inputValue();
const nm = await panel.locator('.chat-msg').count();
check('Chatbot: Detener sin respuesta devuelve la pregunta al cuadro', tv === 'Pregunta lenta' && nm === 2, `cuadro "${tv}", ${nm} mensajes`);
await page.route('**/integridad-estructural-ia.vercel.app/**', (r) =>
  r.fulfill({ status: 429, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'retry-after': '0' }, body: JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: 'Demasiadas consultas seguidas.' } }) }),
);
await panel.locator('textarea').fill('Pregunta con límite');
await page.keyboard.press('Enter');
await panel.locator('[role=alert]').waitFor();
check(
  'Chatbot: límite de 25 consultas explicado y pregunta conservada',
  (await panel.locator('[role=alert]').innerText()).includes('25 cada 10 minutos') && (await panel.locator('textarea').inputValue()) === 'Pregunta con límite',
  await panel.locator('[role=alert]').innerText(),
);
await page.unroute('**/integridad-estructural-ia.vercel.app/**');
await panel.getByRole('button', { name: 'Nueva conversación' }).click();
check('Chatbot: Nueva conversación', (await panel.locator('.chat-msg').count()) === 0);
await panel.getByRole('button', { name: 'Cerrar' }).click();
await go(page, '#/inspeccion/631-01');
await page.locator('.wz-nav').getByRole('button', { name: 'Siguiente' }).click();
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
await page.waitForTimeout(200);
const fb = (await page.getByRole('button', { name: 'Pregúntale a la IA' }).boundingBox())!;
const nav = (await page.locator('.wz-nav').boundingBox())!;
const cruza = fb.x < nav.x + nav.width && nav.x < fb.x + fb.width && fb.y < nav.y + nav.height && nav.y < fb.y + fb.height;
check('Chatbot: el botón no tapa la barra Atrás / Siguiente', !cruza, `botón y=${Math.round(fb.y)}–${Math.round(fb.y + fb.height)}, barra y=${Math.round(nav.y)}–${Math.round(nav.y + nav.height)}`);

// El 429 simulado en la prueba del límite deja su aviso de recurso en la consola; es esperado.
const reales = errors.filter((e) => !e.includes('status of 429'));
check('Cero errores en consola', reales.length === 0, reales.join(' | '));
await browser.close();
console.log(fails ? `${fails} fallas` : 'Flujo completo sin fallas');
process.exit(fails ? 1 : 0);
