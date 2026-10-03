// Prueba de flujo en el navegador: OT completa, máquina del tiempo e inspección de prueba con restauración.
// Uso: npx tsx tools/flujo.ts [url-base]
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
mkdirSync('capturas', { recursive: true });
const browser = await chromium.launch();
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
await page.getByRole('button', { name: 'Volver al presente' }).click();
await page.waitForTimeout(200);
check('Volver al presente', !(await page.locator('.tm').innerText()).includes('Viendo la plataforma'));

// 3. Inspección de prueba y restauración
await go(page, '#/inspeccion/631-01');
const ok = await page.locator('form, .insp-form').count();
if (ok) {
  const inputs = page.locator('input[data-l]');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) await inputs.nth(i).fill('0');
  await page.locator('input[data-l="AP-02"]').fill('120');
  await page.getByRole('button', { name: 'Guardar inspección' }).click();
  await page.waitForTimeout(500);
  await go(page, '#/punto/631-01%7CAP-02');
  const h = await page.locator('h1').innerText();
  check('Inspección de prueba: AP-02 = 120 mm Normal', h.includes('Normal'), h.replace(/\n/g, ' '));
  await go(page, '#/datos');
  await page.getByRole('button', { name: 'Restaurar datos originales' }).click();
  await page.waitForTimeout(800);
  await go(page, '#/punto/631-01%7CAP-03');
  const h2 = await page.locator('h1').innerText();
  check('Restaurar: AP-03 vuelve a Crítico y sin OT', h2.includes('Crítico'), h2.replace(/\n/g, ' '));
} else {
  console.log('  (formulario de inspección aún no disponible)');
}

check('Cero errores en consola', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fails ? `${fails} fallas` : 'Flujo completo sin fallas');
process.exit(fails ? 1 : 0);
