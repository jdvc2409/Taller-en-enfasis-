// Capturas de página completa de cada ruta, en oscuro y claro a 1400 px y en celular a 390 px.
// Uso: npx tsx tools/capturas.ts [url-base] [rutas separadas por coma] [carpeta]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

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

const browser = await chromium.launch();
const errors: string[] = [];
const variants: [string, number, 'dark' | 'light'][] = [
  ['oscuro', 1400, 'dark'],
  ['claro', 1400, 'light'],
  ['movil', 390, 'dark'],
];
for (const [vname, width, theme] of variants) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => localStorage.setItem('tema', t), theme);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${vname}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${vname}] ${e.message}`));
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
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'Sin errores en consola ni desplazamiento horizontal.');
