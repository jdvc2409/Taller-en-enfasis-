// Abre Chromium para las pruebas. Usa el navegador de Playwright; si existe uno preinstalado
// (variable CHROMIUM o /opt/pw-browsers) lo usa, con WebGL por software para que el 3D se dibuje.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const PREINSTALADO = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export function abrirNavegador() {
  const executablePath = process.env.CHROMIUM ?? (existsSync(PREINSTALADO) ? PREINSTALADO : undefined);
  return chromium.launch({
    executablePath,
    args: executablePath ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });
}
