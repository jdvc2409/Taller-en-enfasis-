// Capturas de página completa de cada ruta, en oscuro y claro a 1400 px y en celular a 390 px.
// Además: Inicio en 3 posiciones del recorrido por scroll y el chatbot abierto (respuesta de IA interceptada).
// Revisa que no haya desplazamiento horizontal, errores de consola ni el botón del chatbot sobre las tarjetas.
// Uso: npx tsx tools/capturas.ts [url-base] [rutas separadas por coma] [carpeta]
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrirNavegador } from './navegador';
import { interceptarIA } from './ia-falsa';

const base = process.argv[2] ?? 'http://localhost:5173/';
const only = process.argv[3]?.split(',').filter(Boolean);
const out = process.argv[4] ?? 'capturas';
mkdirSync(out, { recursive: true });

const ROUTES: [string, string][] = [
  ['inicio', '#/'],
  ['flota', '#/flota'],
  ['equipo', '#/equipo/631-01'],
  ['zona-ap', '#/equipo/631-01/zona/AP'],
  ['punto-ap03', '#/punto/631-01%7CAP-03'],
  ['punto-ap03-corte', '#/punto/631-01%7CAP-03?corte=2024-04-30'],
  ['historial', '#/historial'],
  ['ot', '#/ot'],
  ['inspeccion', '#/inspeccion/631-01'],
  ['datos', '#/datos'],
];

const RESPUESTA = `**No.** El equipo 631-01 no debe operar hoy.

- **AP-03** (oreja de levante del apron) está **Crítico**: 400 mm con fractura reportada el 5 feb 2026.
- Prioridad **P1**: reparar antes de continuar operando.

Ábrelo en *Qué reparar* o en la vista del punto AP-03 para crear la orden de trabajo.`;

const browser = await abrirNavegador();
const errors: string[] = [];
const variants: [string, number, 'dark' | 'light'][] = [
  ['oscuro', 1400, 'dark'],
  ['claro', 1400, 'light'],
  ['movil', 390, 'dark'],
];

/** ¿Se cruzan el botón del chatbot y alguno de los elementos? */
async function tapa(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const fab = document.querySelector('.chat-fab')?.getBoundingClientRect();
    if (!fab) return [];
    return [...document.querySelectorAll(sel)]
      .filter((el) => getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0')
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && fab.left < r.right && r.left < fab.right && fab.top < r.bottom && r.top < fab.bottom)
      .map((r) => `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }, selector);
}

for (const [vname, width, theme] of variants) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => localStorage.setItem('tema', t), theme);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${vname}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${vname}] ${e.message}`));
  await interceptarIA(page, () => RESPUESTA);
  for (const [name, hash] of ROUTES) {
    if (only && !only.includes(name)) continue;
    await page.goto(base + hash);
    await page.reload();
    await page.waitForSelector('.page > *:not(.loading)', { timeout: 15000 });
    await page.waitForTimeout(700);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (sw > 0) errors.push(`[${vname}] ${name}: desplazamiento horizontal de ${sw}px`);
    await page.screenshot({ path: `${out}/${name}-${vname}.png`, fullPage: true });
  }

  // Recorrido por scroll de Inicio en 3 posiciones (capturas de la ventana, no de página completa).
  if (!only || only.includes('recorrido')) {
    await page.goto(base + '#/');
    await page.reload();
    await page.waitForSelector('.story', { timeout: 15000 });
    const story = await page.evaluate(() => {
      const r = document.querySelector('.story')!.getBoundingClientRect();
      return { top: r.top + scrollY, h: r.height };
    });
    for (const [i, f] of [0.12, 0.45, 0.8].entries()) {
      await page.evaluate((y) => window.scrollTo(0, y), story.top + story.h * f);
      await page.waitForTimeout(4000); // WebGL por software: dar tiempo al 3D y a las transiciones
      await page.screenshot({ path: `${out}/recorrido-${i + 1}-${vname}.png` });
      const t = await tapa(page, '.story-card.on, .story-rail');
      if (t.length) errors.push(`[${vname}] recorrido ${i + 1}: el botón del chatbot tapa ${t.join('; ')}`);
    }
  }

  // Chatbot abierto sobre el punto AP-03, con una respuesta.
  if (!only || only.includes('chat')) {
    await page.goto(base + '#/punto/631-01%7CAP-03');
    await page.reload();
    await page.waitForSelector('.page > *:not(.loading)', { timeout: 15000 });
    await page.getByRole('button', { name: 'Pregúntale a la IA' }).click();
    const panel = page.getByRole('dialog', { name: 'Pregúntale a la IA' });
    await panel.waitFor();
    await page.screenshot({ path: `${out}/chat-vacio-${vname}.png` });
    await panel.locator('textarea').fill('¿Puede operar hoy el equipo?');
    await page.keyboard.press('Enter');
    await panel.locator('.chat-copy').waitFor();
    await page.waitForTimeout(300);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (sw > 0) errors.push(`[${vname}] chat: desplazamiento horizontal de ${sw}px`);
    await page.screenshot({ path: `${out}/chat-${vname}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'Sin errores en consola, sin desplazamiento horizontal y sin elementos tapados por el chatbot.');
