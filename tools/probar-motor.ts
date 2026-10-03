// Pruebas de aceptación del motor (sección 3 del encargo).
// Uso: npx tsx tools/probar-motor.ts [fecha-corte]
import { readFileSync } from 'node:fs';
import { emptyDB, mergeImport, parseWorkbook } from '../src/lib/importer';
import { analyze, STATUS_LABEL, type PointAnalysis } from '../src/lib/analysis';

const file = new URL('../public/data/631G_historial_grietas.xlsx', import.meta.url);
const parsed = parseWorkbook(readFileSync(file));
const { db } = mergeImport(emptyDB(), parsed, 'reemplazar');
const cutArg = process.argv[2] ?? null;

let fails = 0;
let passes = 0;
const near = (a: number | null | undefined, b: number, tol = 0.01) => a != null && Math.abs(a - b) <= Math.abs(b) * tol;
function check(name: string, ok: boolean, got: unknown) {
  if (ok) passes++;
  else fails++;
  console.log(`${ok ? '  ok ' : ' FALLA'}  ${name}  →  ${typeof got === 'string' ? got : JSON.stringify(got)}`);
}
const f0 = (n: number | null | undefined, d = 0) => (n == null ? '—' : n.toLocaleString('es-CO', { maximumFractionDigits: d }));
const pt = (a: ReturnType<typeof analyze>, code: string) => a.points.find((p) => p.point.code === code)!;
const describe = (p: PointAnalysis) =>
  `${p.point.code} ${STATUS_LABEL[p.status]} ${p.length ?? 'N/I'} mm ${p.priority} | ${p.fit.model} n=${p.fit.n} ${f0(p.rate, 1)} mm/100h | Danger c/p/o ${f0(p.toDanger.central)}/${f0(p.toDanger.pessimistic)}/${f0(p.toDanger.optimistic)} h`;

if (parsed.warnings.length) console.log('Advertencias del importador:', parsed.warnings);

if (cutArg) {
  const a = analyze(db, cutArg);
  const u = a.units[0];
  console.log(`\nCorte ${cutArg} (horómetro ${f0(u.nowHours, 1)} h, ${u.nowDate})`);
  for (const p of u.points) console.log('  ' + describe(p) + ' | ' + p.action);
  console.log('\nHallazgos:');
  for (const f of u.findings) console.log(`  [${f.severity}] ${f.title}: ${f.text}`);
  process.exit(0);
}

// ---------------- Corte de la última inspección
const a = analyze(db, null);
const u = a.units[0];
console.log('\n== Al corte de la última inspección (2026-02-05) ==');
check('Registros, equipos, zonas, puntos, inspecciones', JSON.stringify([db.inspections.length, db.units.length, db.zones.length, db.points.length, db.events.length]) === '[300,1,3,12,25]', [db.inspections.length, db.units.length, db.zones.length, db.points.length, db.events.length]);
check('Horómetro al corte 55.696,5 h', u.nowHours === 55696.5, u.nowHours);
check('Uso promedio ≈ 15,7 h/día', near(u.usage, 15.69, 0.01), f0(u.usage, 2));
check('Celdas N/I = 20', u.niCells === 20, u.niCells);
check('Reparaciones = 24', u.repairs === 24, u.repairs);
check('MTBF estructural ≈ 716 h', near(u.mtbf, (55696.5 - 38520) / 24), f0(u.mtbf, 1));
const ap3 = pt(a, 'AP-03');
check('AP-03 Crítico, 400 mm, P1', ap3.status === 'critico' && ap3.length === 400 && ap3.priority === 'P1', describe(ap3));
const others = u.points.filter((p) => p.point.code !== 'AP-03');
check('Otros 11 puntos sin grieta', others.every((p) => p.status === 'sin'), others.map((p) => `${p.point.code}:${p.status}`).join(' '));
check('AP-03 sobre Danger: ≥ 3.350 h confirmadas', near(ap3.kpis.dangerConfirmed, 3350.1, 0.01), f0(ap3.kpis.dangerConfirmed, 1));
check('AP-03 sobre Danger: hasta 4.585 h', near(ap3.kpis.dangerMax, 4585.3, 0.01), f0(ap3.kpis.dangerMax, 1));
check('AP-03 en 2 episodios', ap3.kpis.dangerEpisodes === 2, ap3.kpis.dangerEpisodes);
const bw4 = pt(a, 'BW-04');
const bw4crit = bw4.series.find((s) => s.date === '2025-06-29');
const bw4rep = bw4.series.find((s) => s.repaired && s.date > '2025-06-29');
check('BW-04 2.200 mm el 2025-06-29', bw4crit?.length === 2200 && bw4crit.status === 'critico', bw4crit?.length);
check('BW-04 reparación 1.922 h después', near((bw4rep?.hours ?? 0) - (bw4crit?.hours ?? 0), 1922.3, 0.01), f0((bw4rep?.hours ?? 0) - (bw4crit?.hours ?? 0), 1));
const longs = u.events.filter((e) => e.event.flags.some((f) => f.type === 'intervalo'));
check(
  'Intervalos largos 2025-10-20 (113 d, 1.922 h) y 2026-02-05 (108 d, 1.533 h)',
  longs.length === 2 && longs[0].event.date === '2025-10-20' && longs[0].sinceDays === 113 && near(longs[0].sinceHours, 1922.3) && longs[1].event.date === '2026-02-05' && longs[1].sinceDays === 108 && near(longs[1].sinceHours, 1532.9),
  longs.map((e) => `${e.event.date} ${e.sinceDays} d ${f0(e.sinceHours, 1)} h críticos:[${e.criticalOpen}]`).join('; '),
);
check('Mediana de 41 días', u.medianDays === 41, u.medianDays);
check('Ambos intervalos largos con un punto crítico', longs.every((e) => e.criticalOpen.length > 0), longs.map((e) => e.criticalOpen.join(',')).join(' | '));
const partial = u.events.filter((e) => e.event.flags.some((f) => f.type === 'parcial' && f.severity === 'warn'));
check('Parciales 2024-10-01 y 2024-10-31 con 8 N/I', partial.map((e) => `${e.event.date}:${e.ni}`).join(' ') === '2024-10-01:8 2024-10-31:8', partial.map((e) => `${e.event.date}:${e.ni}`).join(' '));
const atip = a.inspections.filter((i) => i.flags.some((f) => f.type === 'atipico'));
check('Atípico excluido BW-03 2023-12-02 = 290', atip.length === 1 && atip[0].code === 'BW-03' && atip[0].date === '2023-12-02' && atip[0].length === 290 && atip[0].excluded, atip.map((i) => `${i.code} ${i.date} ${i.length}`));
const bajas = a.inspections.filter((i) => i.flags.some((f) => f.type === 'baja'));
const leves = a.inspections.filter((i) => i.flags.some((f) => f.type === 'baja-leve'));
check('Baja AP-04 2025-06-29 540 → 400', bajas.length === 1 && bajas[0].code === 'AP-04' && bajas[0].date === '2025-06-29' && bajas[0].length === 400, bajas.map((i) => `${i.code} ${i.date} ${i.length}`));
check('Bajas leves BW-01 (600) y EY-03 (540)', leves.map((i) => `${i.code}:${i.length}`).sort().join(' ') === 'BW-01:600 EY-03:540', leves.map((i) => `${i.code} ${i.date} ${i.length}`));
const saltos = a.inspections.filter((i) => i.flags.some((f) => f.type === 'salto'));
check(
  'Saltos BW-02 250→1.100, BW-03 0→1.800, BW-04 0→2.200',
  saltos.map((i) => `${i.code}:${i.length}`).sort().join(' ') === 'BW-02:1100 BW-03:1800 BW-04:2200',
  saltos.map((i) => `${i.code} ${i.date} ${i.length}`),
);
const camp = u.events.filter((e) => e.repairs >= 5);
check('Campaña 2025-01-27 con 8 reparaciones', camp.length === 1 && camp[0].event.date === '2025-01-27' && camp[0].repairs === 8, camp.map((e) => `${e.event.date}:${e.repairs}`));
check('Ritmo típico ≈ 6 mm/100 h', near(u.typicalRate, 6, 0.05), f0(u.typicalRate, 2));
const rec = u.points.filter((p) => p.recurrent).map((p) => p.point.code).sort();
check('Reincidentes', rec.join(',') === 'AP-02,AP-04,BW-01,BW-02,BW-03,BW-04,EY-02,EY-03', rec.join(','));
check('Inspecciones a tiempo ≈ 71 %', near(u.onTimePct, 17 / 24, 0.001), `${u.onTimeCount[0]}/${u.onTimeCount[1]} = ${f0((u.onTimePct ?? 0) * 100, 1)} %`);
check('Reparación no confundida con "hasta reparar"', !ap3.series.some((s) => s.repaired && s.date === '2026-02-05') && ap3.fractured, `fracturado=${ap3.fractured}`);
console.log(`  info  Horas con punto crítico: ${f0(u.hoursWithCriticalConfirmed, 1)} confirmadas, ${f0(u.hoursWithCritical, 1)} hasta reparación o corte`);
console.log(`  info  AP-03 cota superior sobre Danger: ${f0(ap3.kpis.dangerUpper, 1)} h`);
console.log(`  info  Fallas (episodios sobre Danger): ${u.failures}; MTBF de falla ${f0(u.mtbfFailure, 0)} h`);
console.log(`  info  Uso para pronóstico: ${f0(u.usageForecast, 2)} h/día`);

// ---------------- Máquina del tiempo 2024-04-30
console.log('\n== Máquina del tiempo, corte 2024-04-30 ==');
const b = analyze(db, '2024-04-30');
const ap3b = pt(b, 'AP-03');
check('AP-03 = 380 mm, Alerta, P1', ap3b.length === 380 && ap3b.status === 'alerta' && ap3b.priority === 'P1', describe(ap3b));
check('Ajuste lineal con 6 medidas ≈ 7,7 mm/100 h', ap3b.fit.model === 'lineal' && ap3b.fit.n === 6 && near(ap3b.rate, 7.66, 0.01), `${ap3b.fit.model} n=${ap3b.fit.n} ${f0(ap3b.rate, 2)}`);
check('Danger central ≈ 325 h', near(ap3b.toDanger.central, 325.5), f0(ap3b.toDanger.central, 1));
check('Danger pesimista ≈ 115 h', near(ap3b.toDanger.pessimistic, 115.5), f0(ap3b.toDanger.pessimistic, 1));
check('Danger optimista ≈ 551 h', near(ap3b.toDanger.optimistic, 551.5), f0(ap3b.toDanger.optimistic, 1));
const after = ap3.series.find((s) => s.date > '2024-04-30' && s.length != null)!;
const hNow = b.units[0].nowHours!;
check('Siguiente inspección 685 h después midió 410 mm', near(after.hours! - hNow, 685, 0.01) && after.length === 410, `${f0(after.hours! - hNow, 1)} h, ${after.length} mm`);
console.log('  info  ' + ap3b.action + ' | ' + ap3b.priorityWhy);
console.log('  info  ' + ap3b.fit.note);

// ---------------- Corte 2024-06-10
console.log('\n== Corte 2024-06-10 ==');
const c = analyze(db, '2024-06-10');
const s = (code: string) => pt(c, code);
check('AP-03 = 410 mm, Crítico', s('AP-03').length === 410 && s('AP-03').status === 'critico', describe(s('AP-03')));
check(
  'BW-01 500, BW-04 1.080, EY-03 460 en Alerta',
  s('BW-01').length === 500 && s('BW-04').length === 1080 && s('EY-03').length === 460 && ['BW-01', 'BW-04', 'EY-03'].every((k) => s(k).status === 'alerta'),
  ['BW-01', 'BW-04', 'EY-03'].map((k) => `${k}:${s(k).length}:${s(k).status}`).join(' '),
);
const alertas = c.points.filter((p) => p.status === 'alerta').map((p) => p.point.code);
check('Solo esos 3 en Alerta', alertas.sort().join(',') === 'BW-01,BW-04,EY-03', alertas.join(','));

// ---------------- Sin mirar al futuro
console.log('\n== Sin mirar al futuro ==');
const d = analyze(db, '2023-12-02');
const bw3 = d.inspections.find((i) => i.code === 'BW-03' && i.date === '2023-12-02')!;
check('BW-03 2023-12-02 no es atípico si aún no hay medida siguiente', !bw3.flags.some((f) => f.type === 'atipico') && !bw3.excluded, bw3.flags.map((f) => f.type));
check('…y el estado no mejora por la baja', pt(d, 'BW-03').length === 720, `${pt(d, 'BW-03').length} mm ${pt(d, 'BW-03').status}`);

console.log(`\n${passes} correctas, ${fails} fallas`);
process.exit(fails ? 1 : 0);
