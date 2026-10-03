# Integridad Estructural · Traílla CAT 631G

Plataforma web para pasar de la visión global de la flota al historial de una grieta específica, y para decidir qué atender primero. Trabajo del segundo corte de **Gestión del Mantenimiento** (Universidad de La Sabana).

**Link:** https://jdvc2409.github.io/Taller-en-enfasis-/

La plataforma carga sola el historial real (`631G_historial_grietas.xlsx`: equipo 631-01, 25 inspecciones, 12 puntos, 300 registros). No se inventaron equipos ni datos: funciona para N equipos y se muestra con los datos reales.

## Cómo usarla

| Pantalla | Para qué sirve |
|---|---|
| **Flota** | "Qué atender primero" (puntos con grieta ordenados por prioridad), indicadores, reincidentes, matriz de riesgo 5×5 y hallazgos. |
| **Equipo** | Modelo 3D con los puntos por estado, historia completa en mapa de calor (12 puntos × 25 inspecciones), todos los hallazgos e informe ejecutivo con IA. |
| **Zona** | Esquema real con los puntos anclados; modo "Mover puntos"; criticidad de la zona; minigráficas. |
| **Punto** | Gráfica de evolución contra horas o fecha con Caution, Danger, reparaciones y pronóstico con banda del 90 %; cuándo llega a Caution y Danger; fotos con análisis por IA; historial con incluir o excluir cada medida; OT del punto. |
| **Máquina del tiempo** | Franja con una marca por inspección. Muestra la plataforma tal como estaba en cualquier fecha y, en gris, lo que se midió después, para comparar el pronóstico con la realidad. También se abre con un enlace: `#/punto/631-01%7CAP-03?corte=2024-04-30`. |
| **Órdenes de trabajo** | OT sugeridas, kanban (Notificación → OT abierta → Planeada → Programada → Ejecutada → Cerrada), documento con clasificación ISO 14224, operaciones, materiales y costo. Al cerrar con END final aceptado se registra la reparación (L = 0) y el punto empieza un ciclo nuevo. |
| **Registrar inspección** | Réplica del formato de campo (encabezado, criterios, tabla por zona, esquema, observaciones). Se puede imprimir. |
| **Historial** | Filtros por zona, punto, estado y fecha. Exportar a Excel con el mismo formato de entrada (Léame, Historial y Puntos). |
| **Datos** | Carga de Excel (agregar o reemplazar), revisión de calidad, criticidades, parámetros, límites, IA, imágenes, respaldo JSON y "Restaurar datos originales". |

Todo lo que se edita se guarda en el navegador (IndexedDB).

## Correr localmente

```bash
npm install
npm run dev                      # http://localhost:5173
npx tsx tools/probar-motor.ts    # pruebas de aceptación del motor (37 verificaciones)
npx tsx tools/probar-motor.ts 2024-04-30   # tabla de puntos y hallazgos a cualquier fecha de corte
npx tsx tools/flujo.ts           # flujo en el navegador (requiere npx playwright install chromium)
npx tsx tools/capturas.ts        # capturas de todas las pantallas en oscuro, claro y celular
```

## Cómo se calcula cada cosa

**Estado** (criterio del formato): Normal si L < Caution; Alerta si Caution ≤ L < Danger; Crítico si L ≥ Danger; N/I si la celda está vacía. Un N/I nunca se trata como 0. Una reparación es L = 0 con un comentario que la afirma ("Zona reparada por soldadura") y abre un ciclo nuevo.

Criterios conservadores que agregó la revisión de ingeniería:
- Una grieta no se cierra sola: dentro de un ciclo, el estado usa la mayor medida válida. Solo una reparación lo baja.
- Un comentario de fractura o grieta pasante deja el punto en Crítico.
- Excluir una medida la saca de la tendencia, pero no mejora el estado.

**Calidad de datos.** Cada registro se marca y las marcas se recalculan con los datos hasta la fecha de corte, sin mirar al futuro:
- `atipico`: baja de más del 30 % y la siguiente medida vuelve a ≥ 90 %. Se excluye del pronóstico.
- `baja-leve` y `baja`: bajas sin reparación.
- `salto`: crecimiento mayor que máx(100; 4 × mediana) mm por cada 100 h.
- `horometro`, `intervalo` y `parcial`: problemas de la inspección completa (horómetro inválido, intervalo largo, puntos sin inspeccionar).

El usuario puede incluir o excluir cualquier medida.

**Pronóstico.** Usa el ciclo actual (desde la última reparación), con las medidas mayores que 0.
- **Con 3 o más medidas:** ajuste lineal L = a + b·h o exponencial ln L = a + b·h. El exponencial se elige solo si su error es menor que 0,9 × el lineal, y se justifica con la ley de Paris, da/dN ∝ ΔK^m.
- **Banda de predicción del 90 %:** t de Student con n − 2 grados de libertad, limitada a 3; error mínimo de 5 mm, que es la resolución de la medida.
- **Con 2 medidas:** recta entre ambas, con banda ×0,6 a ×1,6.
- **Con 1 medida, o con pendiente ≤ 0:** se proyecta con el ritmo histórico del punto o el típico del equipo, con banda ×0,5 a ×2. Una grieta de fatiga no se acorta, así que nunca se declara "estable" si hay un ritmo de referencia.
- **Horas hasta Caution y Danger:** se busca el cruce de la curva central, del borde pesimista y del borde optimista, hasta 15.000 h adelante.
- **Paso a fechas:** con el mayor entre el uso promedio y el de las últimas 3 inspecciones.

**Prioridad = urgencia × consecuencia.**
- **Urgencia:** sale del tiempo pesimista T hasta Danger. Crítico o T ≤ 250 h da 5; T ≤ 500 da 4; T ≤ 1.000 da 3; T ≤ 2.500 da 2; si no, 1. Una Alerta vale al menos 3 y un Normal con grieta al menos 2.
- **Consecuencia:** Caja 5, Apron 4, Eyector 3. La oreja de levante (AP-03) y el pivote (AP-01) tienen 5 propio, porque su falla puede dejar caer la compuerta.
- **P1 (Inmediata):** Crítico o puntaje ≥ 20. También es P1 cuando el pesimista llega a Danger en ≤ 200 h o cuando el punto puede estar crítico sin verificar.
- **P2:** puntaje ≥ 12. **P3:** ≥ 6. **P4:** el resto.

**Próxima inspección:** la mitad del tiempo pesimista restante (tolerancia al daño), sin pasar de 700 h. Si esa mitad es demasiado corta, la acción es "reparar ya o restringir la operación".

**Indicadores.**
- **MTBF estructural** = horas observadas / reparaciones; en rigor es un tiempo medio entre reparaciones.
- **MTBF de falla** (definición del curso) = horas observadas / episodios sobre Danger o fracturas.
- **Horas con al menos un punto crítico:** confirmadas, y hasta la reparación o el corte.
- **% de inspecciones a tiempo:** intervalos ≤ 700 h.
- **Backlog:** en h-hombre y en semanas, con una capacidad de 96 h-h por semana.

**Hallazgos automáticos**, ordenados por severidad:
1. Operación sobre Danger.
2. Reincidentes (≥ 2 reparaciones) y puntos que exigen análisis de causa raíz.
3. Intervalos largos, sobre todo si ocurrieron con un punto crítico.
4. Puntos en Alerta o Crítico que quedaron N/I, e inspecciones parciales.
5. Crecimientos atípicos.
6. Medidas que bajan sin reparación.
7. Campañas de reparación.

## Qué encontró la plataforma en los datos

Al corte de la última inspección (5 feb 2026, horómetro 55.696,5 h, uso 15,7 h/día):

- **AP-03 (oreja de levante del apron) está en Crítico:** mide 400 mm y el inspector reportó "Fractura. Equipo no debe operar hasta reparar". Es P1 y el equipo no debe operar.
- **AP-03 operó sobre Danger en 2 episodios:** al menos **3.350 h confirmadas**, 4.585 h hasta la reparación o el corte, y una cota superior de 7.193 h. BW-04 superó Danger (2.200 mm el 29 jun 2025) y la reparación se registró **1.922 h** después.
- **Dos intervalos largos ocurrieron con un punto crítico:** 113 días y 1.922 h hasta el 20 oct 2025, con BW-04 crítico; 108 días y 1.533 h hasta el 5 feb 2026, con AP-03 crítico. La mediana es de 41 días. Con un punto crítico, el intervalo debió acortarse, no alargarse.
- **Puntos con grieta quedaron sin inspeccionar:**
  - 1 oct 2024 (solo se inspeccionó el Apron): BW-01 y EY-03 en Alerta.
  - 31 oct 2024 (solo se inspeccionó la Caja): EY-03 en Alerta y AP-03 en Crítico, con grieta pasante.
- **Hay 8 puntos reincidentes** (AP-02, AP-04, BW-01, BW-02, BW-03, BW-04, EY-02 y EY-03), y AP-03 exige análisis de causa raíz por haber operado sobre Danger. Reparar y volver a reparar no elimina la causa: hace falta análisis de causa raíz, refuerzo o un cambio de procedimiento (mantenimiento proactivo).
- **La campaña de reparación del 27 ene 2025 reparó 8 puntos en una parada.** Unas 600 h después aparecieron crecimientos atípicos: BW-02 pasó de 250 a 1.100 mm, BW-03 de 0 a 1.800 mm y BW-04 de 0 a 2.200 mm. Puede ser una reparación deficiente o un error de digitación.
- **Calidad de datos:**
  - BW-03 = 290 mm el 2 dic 2023 es un valor atípico y se excluye del pronóstico.
  - AP-04 bajó de 540 a 400 mm sin reparación: hay que verificarlo.
  - BW-01 (de 660 a 600) y EY-03 (de 570 a 540) bajaron dentro de la dispersión normal de medición.
  - Hay 20 celdas N/I.
- **Indicadores:**
  - 24 reparaciones; MTBF estructural ≈ 716 h; MTBF de falla ≈ 5.726 h (3 fallas).
  - 71 % de las inspecciones a tiempo (17 de 24).
  - Ritmo típico de crecimiento ≈ 5,9 mm por cada 100 h.

**Máquina del tiempo al 30 abr 2024** (la prueba de que la plataforma ayuda a decidir):
- AP-03 medía 380 mm, en Alerta.
- Ajuste lineal con 6 medidas (7,7 mm por cada 100 h, R² = 0,996).
- **Danger en ≈ 325 h**, en un rango de 115 a 551 h. Prioridad P1: "reparar ya o restringir la operación".
- En la realidad, la siguiente inspección, 685 h después, ya midió 410 mm, sobre Danger, y la grieta llegó a 540 mm y a ser pasante antes de repararse. La plataforma lo habría anticipado.

## Uso de inteligencia artificial

**En el desarrollo.**
- La plataforma se construyó con Claude Code (Claude Opus 5.5).
- Un segundo agente de IA revisó de forma independiente:
  - Recalculó en Python todos los valores de aceptación.
  - Contrastó las reglas con las presentaciones del curso, la ISO 14224 y la práctica de tolerancia al daño.
  - Propuso las correcciones conservadoras descritas arriba: fractura, N/I en puntos críticos, pendiente ≤ 0, cierre de OT con END y pasos de seguridad en la OT.

**Dentro de la plataforma** (Claude, llamado desde el navegador con el SDK oficial):
1. **Informe ejecutivo del equipo:** estado, decisiones de la semana, riesgos y causa raíz, fallas de gestión, calidad de datos y recomendaciones proactivas.
2. **Diagnóstico de un punto:** confiabilidad de la tendencia, cuándo y cómo intervenir, causa raíz probable y cómo evitar que reincida.
3. **Análisis de foto (visión):** describe la indicación, dice si parece pasante, si es coherente con la medida y qué verificar en campo.

El mensaje de sistema obliga a respetar la seguridad:
- Nunca recomendar operar con un punto Crítico.
- Tratar como real una medida dudosa que indique peor condición.
- No presentar procedimientos como aprobados.

Cada panel muestra "Ver la información que se envía". **Cualquier persona que abra el link puede usar la IA sin pegar una clave.** Las consultas pasan por un intermediario en Vercel (`proxy/`, desplegado en `https://integridad-estructural-ia.vercel.app`) que guarda la clave de Anthropic como secreto del servidor. **La clave nunca está en la página, en el código ni en el repositorio.** El intermediario:
- Solo acepta consultas desde la página publicada.
- Solo permite los modelos de la app y una pregunta por consulta.
- Usa siempre el mensaje de sistema de la plataforma.
- Admite como máximo 25 consultas por persona cada 10 minutos.

Opcionalmente se puede usar una clave propia en Datos → IA, que queda solo en ese navegador. Cada panel ofrece también "Copiar para Claude". Modelo por defecto: `claude-opus-5-5`; también `claude-sonnet-5` y `claude-haiku-4-5`.

## Advertencias

- Los tiempos, operaciones y materiales de la OT son una **plantilla de referencia**, no un procedimiento aprobado: validar contra el procedimiento del fabricante y la WPS calificada.
- El modelo 3D es una representación simplificada.
- Los pronósticos son estimaciones estadísticas sobre datos de campo: la decisión final es del ingeniero responsable.

## Técnica

Vite, React 18 y TypeScript estricto. SheetJS para leer y escribir Excel, Three.js para el 3D, zustand para el estado, idb-keyval para guardar en IndexedDB, y Barlow / Barlow Condensed empaquetadas con @fontsource. Las gráficas son SVG propio. Se despliega en GitHub Pages con GitHub Actions; las pruebas del motor corren antes de cada build.
