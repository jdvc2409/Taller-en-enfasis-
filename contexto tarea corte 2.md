# Contexto de la tarea, corte 2: Plataforma de Integridad Estructural de la Traílla CAT 631G

Este documento reúne todo lo que se hizo: el enunciado, las decisiones, los datos, cómo calcula la plataforma, qué encontró en los datos, la arquitectura, la seguridad, la IA, la publicación, las pruebas y cómo usarla en la exposición. Está escrito para retomar el proyecto sin otra fuente.

- **Materia:** Gestión del Mantenimiento, Universidad de La Sabana. Trabajo individual del segundo corte.
- **Entrega:** exposición en vivo más un link, el **sábado 10 de octubre de 2026**.
- **Link de la plataforma:** https://jdvc2409.github.io/Taller-en-enfasis-/
- **Repositorio:** https://github.com/jdvc2409/Taller-en-enfasis- (público, rama `main`).
- **Intermediario de IA:** https://integridad-estructural-ia.vercel.app (proyecto de Vercel `integridad-estructural-ia`).
- **Carpeta local:** `/home/juan/taller en enfasis/Taller-en-enfasis-`
- **Construido el** 3 de octubre de 2026 con Claude Code (Claude Opus 5.5), más un agente revisor independiente.

---

## Índice

1. [El enunciado del profesor](#1-el-enunciado-del-profesor)
2. [Decisiones tomadas](#2-decisiones-tomadas)
3. [Los datos de origen](#3-los-datos-de-origen)
4. [Qué encontró la plataforma en los datos](#4-qué-encontró-la-plataforma-en-los-datos)
5. [Reglas de cálculo (motor de análisis)](#5-reglas-de-cálculo-motor-de-análisis)
6. [Revisión independiente de ingeniería y cambios por seguridad](#6-revisión-independiente-de-ingeniería-y-cambios-por-seguridad)
7. [Desvíos frente al prompt original y por qué](#7-desvíos-frente-al-prompt-original-y-por-qué)
8. [Pantallas y funciones](#8-pantallas-y-funciones)
9. [Órdenes de trabajo (OT) e ISO 14224](#9-órdenes-de-trabajo-ot-e-iso-14224)
10. [Inteligencia artificial](#10-inteligencia-artificial)
11. [Diseño visual](#11-diseño-visual)
12. [Arquitectura técnica y archivos](#12-arquitectura-técnica-y-archivos)
13. [Pruebas y verificación](#13-pruebas-y-verificación)
14. [Publicación y despliegue](#14-publicación-y-despliegue)
15. [Seguridad de la clave de API](#15-seguridad-de-la-clave-de-api)
16. [Guía para la exposición](#16-guía-para-la-exposición)
17. [Mantenimiento y operación](#17-mantenimiento-y-operación)
18. [Historial de trabajo (commits)](#18-historial-de-trabajo-commits)
19. [Pendientes y recomendaciones](#19-pendientes-y-recomendaciones)

---

## 1. El enunciado del profesor

> Durante los últimos dos años se han generado miles de datos producto de las inspecciones estructurales de los equipos de una flota. El desafío es convertir esos datos en conocimiento. Diseñe y construya una plataforma digital que permita **navegar desde la visión global de la flota hasta el historial de una grieta específica**, integrando datos, imágenes, tendencias e indicadores. La solución deberá ser gráfica, interactiva, intuitiva y **orientada a la toma de decisiones de mantenimiento**. La IA está permitida y se invita a usarla. Una herramienta sofisticada que no ayuda a tomar mejores decisiones de mantenimiento no resuelve el problema.
>
> "Los datos vienen de campo: revísenlos antes de confiar en ellos."

Fuente: `reto/Plataforma_Gestion_Estructural_IA.pptx`. El encargo detallado para Claude Code está en `PROMPT_CLAUDE_CODE.md`.

### Requisitos mínimos (todos cumplidos)

| # | Requisito | Dónde se cumple |
|---|---|---|
| 1 | Cargar datos: leer el historial en Excel sin transcribirlo | Carga automática en la primera visita y Datos → Cargar Excel (`src/lib/importer.ts`) |
| 2 | Historial completo: guardar cada inspección nueva junto con las anteriores | Registrar inspección, Historial y Exportar Excel con el mismo formato |
| 3 | Tendencia por punto contra fecha y contra horas, con Caution y Danger | Vista Punto, gráfica con eje conmutable Horas / Fecha |
| 4 | Imágenes: esquema de la zona y fotos de cada punto | Vista Zona (esquema real), vista Punto (fotos) y Datos → Biblioteca |
| 5 | Alertas: punto cerca del límite, que lo pasa o que crece muy rápido | Alertas por punto, hallazgos y ranking |
| 6 | Registrar y consultar inspecciones con estado; filtros por zona, punto y fecha | Registrar inspección e Historial con filtros |
| — | Uso de IA dentro de la plataforma (obligatorio) | Informe ejecutivo, diagnóstico de punto y análisis de foto |

### Diferenciadores elegidos (todos hechos)

- **Pronóstico de cada grieta:** horas y fecha estimadas para llegar a Caution y Danger, con banda de incertidumbre del 90 %.
- **Ranking de prioridad:** urgencia × consecuencia, con la lista "Qué atender primero".
- **Orden de trabajo automática** con clasificación ISO 14224, kanban y backlog.
- **Esquema 2D interactivo** sobre los esquemas reales, más un **modelo 3D** simplificado con los puntos coloreados por estado.
- **Máquina del tiempo:** la plataforma tal como estaba en cualquier inspección pasada, comparando el pronóstico con lo que pasó después. Es la pieza más fuerte para la exposición.

### Vocabulario del curso que usa la plataforma

- Mantenimiento preventivo basado en condición frente a correctivo (diferido / inmediato).
- Planeación ("¿qué?") frente a programación ("¿cuándo?").
- Ciclo de la OT: Notificación → Aprobación / OT abierta → Planeación → Programación → Ejecución → Reporte → Cierre.
- MTBF, backlog, criticidad (probabilidad × consecuencia), análisis de causa raíz, mantenimiento proactivo, ISO 14224, CMF y CPMV.

Material del curso consultado: `curso/Semana_1` a `Semana_5` (PDF).

---

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance de datos | Un solo equipo real (631-01). La plataforma funciona para N equipos, pero **no se inventaron equipos ni datos**. |
| Publicación | GitHub Pages en `jdvc2409/Taller-en-enfasis-`, desplegado con GitHub Actions. |
| Interfaz | **Oscura por defecto**, pulida y profesional, sin estética de juego ni neón. Hay un botón de tema claro. |
| IA | Modelo por defecto `claude-opus-5-5`. Alternativas: `claude-sonnet-5` y `claude-haiku-4-5`. |
| Clave de API | No va en el código. **Cualquier persona puede usar la IA desde el link**, a través de un intermediario en Vercel que guarda la clave como secreto. Ver la sección 15. |
| Revisión de ingeniería | La pidió la persona. Un segundo agente revisó en paralelo los cálculos, la lógica de mantenimiento y la seguridad, y sus correcciones se aplicaron. |
| Herramientas de diseño | Figma no estaba conectado. El diseño se hizo en código y se revisó con capturas de Playwright en oscuro, claro y celular. |

---

## 3. Los datos de origen

Archivos en `datos-fuente/`, copiados también a `public/data/`:

### 3.1 `631G_historial_grietas.xlsx`

- **Hoja Léame:** Flota = Traílla 631G, Equipo = 631-01, periodo del 2023-02-06 al 2026-02-05, 25 inspecciones, 3 zonas y 12 puntos.
  - `L actual (mm)` = 0 significa sin grieta detectable.
  - **Una celda vacía significa no inspeccionado (N/I) y nunca se convierte en 0.**
  - El horómetro es acumulado.
- **Hoja Historial:** 300 filas con las columnas `Fecha | Equipo | Horas (h) | Inspector | Zona | Código | Descripción | L actual (mm) | Comentario | Imagen`.
  - Hay 20 celdas N/I y 24 reparaciones, registradas como L = 0 con el comentario "Zona reparada por soldadura".
  - Comentarios especiales de AP-03: "Grieta pasante en la base del soporte" (2024-10-01) y "Fractura. Equipo no debe operar hasta reparar" (2026-02-05).
  - Inspectores: INSP-01, INSP-02 e INSP-03.
- **Hoja Puntos:**

| Código | Zona | Descripción | Caution (mm) | Danger (mm) |
|---|---|---|---|---|
| BW-01 | Caja (scraper bowl) | Borde superior delantero izquierdo de la caja | 400 | 800 |
| BW-02 | Caja | Tubo transversal superior y travesaño del piso | 800 | 1500 |
| BW-03 | Caja | Pared lateral derecha, cara interna | 1000 | 2000 |
| BW-04 | Caja | Lateral izquierdo, parte inferior externa | 1000 | 2000 |
| EY-01 | Eyector | Placa de empuje del eyector | 400 | 800 |
| EY-02 | Eyector | Unión de los brazos con la placa de empuje | 250 | 400 |
| EY-03 | Eyector | Brazos del bastidor del eyector | 400 | 700 |
| EY-04 | Eyector | Soporte del cilindro del eyector | 150 | 300 |
| AP-01 | Apron (compuerta delantera) | Oreja de pivote izquierda del apron | 200 | 400 |
| AP-02 | Apron | Placa lateral izquierda del apron | 250 | 500 |
| AP-03 | Apron | Soporte central (oreja de levante) del apron | 200 | 400 |
| AP-04 | Apron | Placa frontal inferior del apron | 300 | 600 |

### 3.2 `631G_formato_inspeccion.docx`

Es el formato de campo que la plataforma replica digitalmente:
- **Encabezado:** FECHA, EQUIPO, HORAS, INSPECTOR y ZONAS, con la nota de que algunas áreas quedan ocultas con el equipo armado.
- **Tabla de criterios:**
  - Normal: seguimiento.
  - Alerta: aumentar la frecuencia y programar reparación.
  - Crítico: reparar antes de continuar operando.
  - N/I.
- **Por cada zona:** tabla `Código | Descripción | Caution | Danger | L anterior | L actual | Estado | Comentario`, esquema, registro fotográfico y observaciones.

Las imágenes que trae el Word se extrajeron así:

| Origen | Destino | Contenido |
|---|---|---|
| image1.png (1680×1140) | `public/data/esquemas/631_BW_caja_bowl.png` | Esquema de la Caja |
| image2.png (1900×1240) | `public/data/esquemas/631_EY_eyector.png` | Esquema del Eyector |
| image3.png (2240×1140) | `public/data/esquemas/631_AP_apron.png` | Esquema del Apron |
| image4.png (604×453) | `public/data/fotos/631_AP-03_2026-02-05.jpg` | Foto de la fractura de AP-03. Era PNG y se convirtió a JPEG real para que coincida con el nombre del Excel. |

**Posición de los puntos en los esquemas.** Se expresa como fracción del ancho y del alto, medida en la punta de la flecha. Se verificó dibujando cada punto sobre su imagen y todos caen en la punta de su flecha.

```
BW-01 (0.075, 0.247)  BW-02 (0.607, 0.400)  BW-03 (0.768, 0.505)  BW-04 (0.393, 0.784)
EY-01 (0.382, 0.226)  EY-02 (0.429, 0.372)  EY-03 (0.279, 0.635)  EY-04 (0.529, 0.523)
AP-01 (0.491, 0.306)  AP-02 (0.559, 0.248)  AP-03 (0.704, 0.463)  AP-04 (0.600, 0.516)
```

---

## 4. Qué encontró la plataforma en los datos

El revisor independiente recalculó todos estos valores en Python y coinciden. Los mismos valores son las pruebas de aceptación de `tools/probar-motor.ts`, y las **37 pasan**.

### Al corte de la última inspección (5 feb 2026)

| Resultado | Valor |
|---|---|
| Registros, equipos, zonas, puntos e inspecciones | 300, 1, 3, 12 y 25 |
| Horómetro al corte | 55.696,5 h |
| Uso promedio | 15,69 h/día (17.176,5 h en 1.095 días) |
| Celdas N/I | 20 |
| Reparaciones | 24 |
| MTBF estructural del encargo (horas observadas / reparaciones) | **≈ 716 h**, que en rigor es un tiempo medio entre reparaciones |
| Fallas: episodios sobre Danger o fractura | 3 (AP-03 dos veces y BW-04 una) |
| MTBF de falla (definición del curso) | **≈ 5.726 h** |
| Estado de AP-03 | **Crítico, 400 mm, P1**, con fractura reportada. El equipo **no debe operar**. |
| Los otros 11 puntos | Sin grieta |
| Horas de AP-03 sobre Danger | **3.350 h confirmadas**, 4.585 h hasta la reparación o el corte y 7.193 h de cota superior, en 2 episodios |
| BW-04 | Superó Danger (2.200 mm el 2025-06-29) y la reparación se registró **1.922 h** después |
| Horas operando con al menos un punto crítico | 3.350 h confirmadas; hasta 6.508 h |
| Intervalos largos | 2025-10-20 (113 días, 1.922 h) con **BW-04 crítico** y 2026-02-05 (108 días, 1.533 h) con **AP-03 crítico**. La mediana es de 41 días. "El intervalo debió acortarse, no alargarse." |
| Inspecciones parciales | 2024-10-01 (solo Apron) y 2024-10-31 (solo Caja), cada una con 8 de 12 puntos N/I |
| Puntos con grieta que quedaron N/I | 2024-10-01: BW-01 y EY-03 en Alerta. 2024-10-31: EY-03 en Alerta y **AP-03 Crítico con grieta pasante** |
| Valor atípico excluido | BW-03 2023-12-02 = 290 mm, entre 720 y 1.030 mm sin reparación |
| Bajas sin reparación | AP-04 2025-06-29 bajó de 540 a 400 (verificar). BW-01 (660 → 600) y EY-03 (570 → 540) son dispersión de medición. |
| Crecimiento atípico | BW-02 de 250 a 1.100, BW-03 de 0 a 1.800 y BW-04 de 0 a 2.200 mm, cada uno en unas 600 h, después de la campaña de reparación |
| Campaña de reparación | 2025-01-27: 8 puntos reparados en una parada |
| Ritmo típico de crecimiento | Mediana ≈ 5,85 mm por cada 100 h |
| Reincidentes (2 o más reparaciones) | AP-02, AP-04, BW-01, BW-02, BW-03, BW-04, EY-02 y EY-03. AP-03 también exige análisis de causa raíz por haber operado sobre Danger y fracturarse. |
| Inspecciones a tiempo (≤ 700 h) | 17 de 24 = **70,8 %** |

### Máquina del tiempo al 30 abr 2024 (la "diapositiva estrella")

- AP-03 medía **380 mm, en Alerta**, con prioridad **P1** (urgencia 5 × consecuencia 5 = 25).
- Ajuste lineal con 6 medidas: **7,7 mm por cada 100 h**, R² = 0,996, error residual 6,0 mm, t de Student con 4 gl = 2,132.
- **Danger en ≈ 325 h**: pesimista ≈ 115 h y optimista ≈ 551 h (alrededor del 20 may 2024).
- La plataforma habría dicho: **"Reparar ya o restringir la operación: el escenario pesimista llega a Danger en 115 h"**.
- **En la realidad, la siguiente inspección, 685 h después, ya midió 410 mm, sobre Danger.** Después la grieta llegó a 540 mm y a ser pasante antes de repararse, y en 2026 se fracturó. La plataforma lo habría anticipado.

### Corte 2024-06-10

AP-03 = 410 mm, Crítico. BW-01 (500 mm), BW-04 (1.080 mm) y EY-03 (460 mm) en Alerta.

---

## 5. Reglas de cálculo (motor de análisis)

Código: `src/lib/importer.ts`, `src/lib/quality.ts` y `src/lib/analysis.ts`. Todo se recalcula a partir de los datos y de una **fecha de corte** opcional. Con corte, solo cuentan las inspecciones con fecha igual o anterior a ese día, **incluso para las marcas de calidad**: la plataforma nunca mira al futuro.

### 5.1 Importador

- Reconoce las columnas por nombre, sin importar mayúsculas, tildes ni orden, e ignora columnas como "L anterior".
- Acepta fechas como fecha de Excel, número serial o texto `dd/mm/aaaa` o `aaaa-mm-dd`. Corrige la deriva de SheetJS sumando 12 h y leyendo los componentes locales.
- Acepta decimales con coma. Interpreta "1.100" como mil cien (miles), con advertencia, porque las grietas se miden a 5 mm.
- **Reparación** = L = 0 y un comentario que la afirma ("reparada", "soldada"). No cuenta si el texto la pide o la niega: "hasta reparar", "no fue reparada", "parcial", "provisional" o "sin END".
- Si hay medida y reparación del mismo punto el mismo día, conserva la reparación y anota la medida en el comentario.
- Funciona con otro Excel de estructura parecida (otra flota u otros equipos). La consecuencia propia de AP-01 y AP-03 solo se aplica en la flota 631G.

### 5.2 Estado

- **N/I:** L vacía.
- **Sin grieta:** L = 0.
- **Crítico:** L ≥ Danger.
- **Alerta:** L ≥ Caution.
- **Normal:** el resto.

**Estado efectivo**, criterio conservador agregado por la revisión:
- **Una grieta no se cierra sola.** Dentro de un ciclo (entre reparaciones), el estado usa la mayor medida válida hasta esa fecha. Solo una reparación lo baja.
- Un comentario de **fractura, grieta pasante o "no debe operar"** deja el punto en Crítico.
- Excluir una medida la saca de la tendencia, pero **no mejora el estado**.

### 5.3 Calidad de datos (marcas por registro)

| Marca | Regla | Efecto |
|---|---|---|
| `atipico` | Baja de más del 30 % frente a la última medida confiable, sin reparación, y la siguiente vuelve a ≥ 90 % | Advertencia; **se excluye** del pronóstico |
| `baja-leve` | Baja ≤ 15 % sin reparación | Informativa (dispersión de medición) |
| `baja` | Cualquier otra baja sin reparación, incluido pasar a 0 sin comentario | Advertencia |
| `salto` | Crecimiento mayor que máx(100; 4 × mediana del equipo) mm por cada 100 h | Advertencia; se mantiene en la tendencia |
| `repara-sin-grieta` | Reparación registrada cuando la medida anterior era 0 | Informativa |
| `horometro` | El horómetro retrocede o supera 24 h/día | Error; las medidas salen del ajuste, sus horas se estiman |
| `intervalo` | Más de 1,5 × 700 h, o más del doble de la mediana de días | Advertencia |
| `parcial` | Hay puntos N/I en la inspección | Advertencia si son la mitad o más |

El usuario puede incluir o excluir cualquier medida, y su decisión prevalece. Los atípicos no entran al ritmo típico del equipo, que se calcula en una segunda pasada.

### 5.4 Ciclos y pronóstico

- **Ciclos:** el historial de cada punto se parte en las reparaciones. El pronóstico usa solo el ciclo actual, con medidas mayores que 0, incluidas y con horómetro.
- **Con 3 o más medidas:**
  - Se ajusta un modelo lineal L = a + b·h y uno exponencial ln L = a + b·h, con h medida desde la primera medida.
  - Se elige el exponencial solo si su error en mm es menor que 0,9 × el del lineal y b > 0. Se justifica con la **ley de Paris**: da/dN ∝ ΔK^m, y con m ≈ 2 el crecimiento es exponencial.
  - **Banda de predicción del 90 %:** t de Student con n − 2 gl (tabla completa de 1 a 30), **limitada a 3**. El término "1 +" de la banda de predicción está incluido.
  - Piso del error residual: 5 mm, la resolución de la medida; en escala logarítmica, 5 / L promedio.
  - Confianza: baja con 3 medidas o menos; alta con 5 o más y R² ≥ 0,8; media en los demás casos.
- **Con 2 medidas:** recta entre ambas, con banda de ×0,6 a ×1,6 del ritmo y confianza baja.
- **Con 1 medida, o con pendiente ≤ 0:** proyección con el **ritmo de referencia**, que es la mediana de los ciclos anteriores del punto o, si no hay, el ritmo típico del equipo. Banda de ×0,5 a ×2. Nunca se declara "estable" si hay un ritmo de referencia, porque una grieta de fatiga no se acorta.
- **Horas hasta Caution y Danger:** la curva central da la estimación central, el borde superior de la banda el escenario pesimista y el inferior el optimista. Se buscan hasta 15.000 h adelante, contadas desde el horómetro **actual del equipo**.
- **Horas a fecha:** se usa el mayor entre el uso promedio global y el de las últimas 3 inspecciones, para que la fecha no salga tarde.
- **Horómetro actual:** el de la última inspección válida. Si la última tiene el horómetro inválido, se estima con los días transcurridos × uso.
- **Ritmo actual:** b × 100 en el modelo lineal y b × L × 100 en el exponencial, en mm por cada 100 h.

### 5.5 Prioridad = urgencia (probabilidad) × consecuencia

**Consecuencia C**, editable:

| Zona / punto | C | Razón |
|---|---|---|
| Caja | 5 | Estructura portante |
| Apron | 4 | Riesgo de seguridad |
| **AP-01 (pivote) y AP-03 (oreja de levante)** | **5, propia del punto** | Su falla puede dejar caer la compuerta sobre una persona |
| Eyector | 3 | Afecta la productividad |

**Urgencia P** según T, las horas pesimistas hasta Danger:
- Crítico, o T ≤ 250: 5.
- T ≤ 500: 4.
- T ≤ 1.000: 3.
- T ≤ 2.500: 2.
- Resto: 1.
- Mínimos: Alerta ≥ 3; Normal con grieta ≥ 2.

**Prioridad:**
- **P1 Inmediata:** Crítico, o P × C ≥ 20. También es P1 si el pesimista llega a Danger en 200 h o menos, o si el punto es un "posible crítico no verificado".
- **P2 Esta semana:** ≥ 12.
- **P3 Próximo mes:** ≥ 6.
- **P4 Seguimiento:** el resto.

**Acción recomendada**, con las palabras del formato:

| Situación | Acción |
|---|---|
| Crítico | "Reparar antes de continuar operando (sacar de servicio)." |
| Posible crítico no verificado | "Inspeccionar antes de seguir operando." |
| Pesimista a Danger ≤ 200 h | "Reparar ya o restringir la operación." |
| Alerta | "Programar reparación antes de T h y reinspeccionar en ≤ X h." |
| Normal | "Seguimiento: reinspeccionar en ≤ X h." |
| Sin grieta y reincidente (o con falla grave) | "Análisis de causa raíz antes de la próxima reparación." |

**Próxima inspección:** la mitad del tiempo pesimista restante, que es la regla de tolerancia al daño, sin pasar de 700 h y **sin piso**. Si la mitad es demasiado corta, la acción pasa a ser reparar o restringir.

### 5.6 Alertas por punto

- Supera Danger.
- En Alerta.
- Cerca de Caution (≥ 80 %).
- Crece rápido (≥ 15 mm por cada 100 h).
- Puede llegar a Danger en menos de 600 h (escenario pesimista).
- Posible crítico no verificado.
- No inspeccionado en la última inspección.
- Sin medición hace más de 1,5 × el intervalo objetivo.
- Reincidente, o con análisis de causa raíz exigido.

Todos los umbrales se editan en Datos.

### 5.7 Indicadores

- **Por punto:** reparaciones, una reparación cada X h, tiempo medio hasta reaparecer, vida media de la grieta, y horas sobre Danger (confirmadas, hasta la reparación o el corte, y cota superior).
- **Por equipo:**
  - Conteo por estado.
  - Reparaciones y MTBF estructural.
  - Fallas y MTBF de falla.
  - Horas con al menos un punto crítico (confirmadas y máximas).
  - % de inspecciones a tiempo.
  - Celdas N/I y ritmo típico.
- **OT:** backlog en h-hombre (OT no ejecutadas ni cerradas) y en semanas, con una capacidad de 96 h-h por semana.

### 5.8 Hallazgos automáticos, por severidad

1. Puntos que operaron sobre Danger, con las horas y el criterio del formato.
2. Reincidentes, en un solo hallazgo, más los puntos con análisis de causa raíz por falla grave.
3. Inspecciones fuera de intervalo. Si ocurrieron con un punto crítico: "el intervalo debió acortarse, no alargarse".
4. Puntos en Alerta o Crítico que quedaron N/I, e inspecciones parciales.
5. Crecimientos atípicos.
6. Medidas que bajan sin reparación.
7. Campañas de reparación (5 o más puntos en una parada).

---

## 6. Revisión independiente de ingeniería y cambios por seguridad

La persona pidió que otro agente revisara en paralelo que los cálculos fueran correctos, que coincidieran con lo visto en clase y que la lógica de mantenimiento sirviera para proyectos reales sin poner en riesgo ningún aspecto. El agente no editó el código; entregó informes y yo apliqué los cambios. Hizo **tres pasadas**.

### Pasada 1: recálculo y contraste con el curso

- **Recalculó en Python todos los valores de la sección 3 del encargo y todos coinciden.** Confirmó que la banda de predicción con "1 +" da 325 / 115 / 551 h; la banda de confianza daría 194 / 472, que no corresponde.
- **Verificó contra el curso:** estados, ciclo de la OT (semana 5), correctivo inmediato y diferido (semana 2), planeación y programación (semanas 3 y 4), backlog, mantenimiento proactivo y criticidad.
- **Verificó los códigos ISO 14224 (anexo B):**
  - Modo: STD Deficiencia estructural y BRD Avería grave.
  - Mecanismo: 2.5 y 2.6.
  - Causa: 3.3 y 3.4.
  - Actividad: 2 Reparación y 11 Combinación.
- **Detectó riesgos que se corrigieron:**
  - "Fractura… no debe operar hasta **reparar**" podía tomarse como una reparación.
  - Medidas peligrosas podían ignorarse por exclusiones o por el horómetro.
  - Una pendiente ≤ 0 se declaraba "estable".
  - El piso de 100 h podía programar la reinspección después de Danger.
  - Los N/I en puntos críticos no se señalaban.
  - La consecuencia del Apron estaba subestimada.
  - El MTBF del encargo no es el MTBF del curso.
  - A la OT le faltaban pasos de seguridad.

### Pasada 2: código del motor (15 hallazgos, todos corregidos)

- **Un punto crítico que bajaba sin reparación pasaba a Alerta.** Ahora se usa el estado efectivo: la mayor medida del ciclo.
- **La prioridad contradecía la acción.** Ahora es P1 forzada cuando la acción es "reparar ya" o cuando el punto es un posible crítico no verificado.
- **"1.100" se leía como 1,1 mm.** Ahora se lee como 1.100, con advertencia.
- Una fractura seguía activa después de repararla.
- Las fracturas por debajo de Danger no contaban como falla.
- La exposición sobre Danger se calcula ahora con todas las medidas válidas.
- Se agregaron negaciones de reparación ("no fue reparada", "parcial", "provisional", "sin END").
- Se estima el horómetro cuando el último es inválido.
- Las OT se muestran en su estado a la fecha de corte.
- Las filas duplicadas que incluyen una reparación se resuelven conservando la reparación.
- Se completó la tabla t, se creó el modelo "ritmo-referencia", el R² usa coma decimal, los atípicos salen del ritmo típico y se dejó de crear puntos inexistentes por equipo.
- El revisor escribió 8 escenarios de borde y todos quedaron bien.

### Pasada 3: OT e IA (21 hallazgos, corregidos)

- **Cerrar la OT el mismo día de la última medida borraba la medida de la fractura.** Ahora el cierre exige una fecha posterior a la última medida del punto.
- **La IA no tenía reglas firmes de seguridad.** Ahora el mensaje de sistema las incluye (sección 10).
- **Se podía bajar la prioridad o diferir la OT de un punto crítico.** Ahora el tipo y la prioridad quedan bloqueados mientras el punto siga crítico.
- **Con END final rechazado, la OT ahora queda "Ejecutada" con retrabajo pendiente**, no "Cerrada".
- CMF y CPMV tienen ahora la definición del curso (costo / facturación y costo / valor de reposición), y el costo incluye materiales.
- El contexto que recibe la IA trae las fechas, el uso para fechas y las marcas: fractura, no verificado, N/I y análisis de causa raíz.
- El análisis de foto no puede mejorar el estado.
- La OT usa solo el ciclo actual, incluye la acción de la plataforma y agrega "verificación antes de operar" cuando corresponde.
- Las OT solo se pueden eliminar en Notificación.
- Pasos de soldadura: desconectar baterías y módulos, pinza de tierra junto a la soldadura y END por personal calificado (ISO 9712 / ASNT nivel II).
- Mecanismo BRD + 2.6 Fatiga; detección "3 Inspección"; electrodo "E7018 o el que indique la WPS".
- Una OT de un punto Normal es solo de inspección.
- Avisos cuando la fecha límite es posterior a la fecha pesimista y cuando se cierra sin registrar la reparación.

---

## 7. Desvíos frente al prompt original y por qué

| Prompt | Lo implementado | Motivo |
|---|---|---|
| Apron con C = 4 | Apron 4, **pero AP-01 y AP-03 con C = 5 propio** (editable) | Seguridad: dejan caer la compuerta. Las cifras de la sección 3 se mantienen. |
| "MTBF estructural ≈ 716 h" | Se muestra tal cual, **y además** el MTBF de falla del curso (≈ 5.726 h) | El curso define MTBF con fallas, no con reparaciones de defectos |
| Pendiente ≤ 0 = estable, sin cruce | Se proyecta con el ritmo de referencia | Una grieta de fatiga no se acorta |
| Próxima inspección entre 100 h y 700 h | Mínimo entre T/2 y 700 h, sin piso; si es muy corta, reparar o restringir | El piso podía caer después de Danger |
| P1 si es Crítico o P×C ≥ 20 | También si el pesimista llega a Danger en ≤ 200 h o si es posible crítico no verificado | Coherencia entre la acción y la prioridad |
| IA con `fetch` directo | **SDK oficial de Anthropic**, cargado solo cuando se usa | Indicación de la referencia oficial para proyectos TypeScript |
| `claude-sonnet-5-5` y `claude-haiku-4-5-20251001` | `claude-sonnet-5` y `claude-haiku-4-5` | El primero no existe; se usa el ID vigente sin fecha |
| max_tokens 2000 | 16.000, con streaming | Opus 5.5 siempre razona antes de responder; con 2.000 tokens la respuesta se cortaría |
| La clave se pega en Datos | **Intermediario en Vercel** para que cualquiera pregunte, más una clave propia opcional | Lo pidió la persona sin exponer la clave (sección 15) |
| Tema por `prefers-color-scheme` | **Oscuro por defecto**, con un botón para el claro | Preferencia de la persona |
| Detección de reparación por texto | Detección más estricta, con negaciones | Evitar que "hasta reparar" abra un ciclo nuevo |

---

## 8. Pantallas y funciones

Las rutas usan `#` para funcionar en GitHub Pages. La barra superior tiene: logo, "Integridad Estructural", Flota, Historial, Órdenes de trabajo, Registrar inspección, Datos y el botón de tema.

### 8.1 Máquina del tiempo (componente compartido en Flota, Equipo, Zona y Punto)

- Franja con una marca por inspección, coloreada con el peor estado medido ese día, y los años debajo.
- Se fija la fecha de corte arrastrando, haciendo clic, con las teclas ← → Inicio Fin, o con los botones de inspección anterior y siguiente. "Volver al presente" quita el corte.
- Con corte en el pasado, la franja se resalta y muestra "Viendo la plataforma como estaba el {fecha}"; las marcas futuras se ven tenues.
- **Enlace directo con corte:** `#/punto/631-01%7CAP-03?corte=2024-04-30`.
- El corte se mantiene al navegar entre pantallas hasta volver al presente.

### 8.2 Flota (`#/`)

- Título "Traílla 631G" y un resumen en una línea, con aviso en rojo si hay puntos críticos.
- Indicadores: puntos en Crítico, en Alerta, horas con punto crítico, MTBF estructural (con el MTBF de falla debajo) y OT abiertas con backlog en semanas.
- **"Qué atender primero":** prioridad, punto, estado, barra de L frente a Caution y Danger, tiempo a Danger (pesimista – central, con fecha), qué hacer, y Crear OT o un enlace a la OT abierta.
- **"Reincidentes: análisis de causa raíz pendiente"**, con píldoras de cada punto.
- Columna lateral: tarjeta del equipo (horómetro, peor estado, una tira con el estado de cada punto) y matriz de riesgo 5×5.
- Hallazgos principales.

### 8.3 Equipo (`#/equipo/631-01`)

- Indicadores: conteos por estado, MTBF estructural, MTBF de falla, horas con punto crítico e inspecciones a tiempo.
- **Modelo 3D** junto a la lista de zonas. Al pasar el mouse por una zona, se resalta en el 3D.
- **Historia completa en mapa de calor** (12 × 25):
  - Valor en mm (≥ 1000 como 1.1k).
  - R = reparada, rayado = N/I, borde punteado = excluida.
  - Encabezados en ámbar cuando hubo intervalo largo o inspección parcial.
  - Lo posterior al corte se ve tenue. Clic en una celda abre el punto.
- Todos los hallazgos.
- Botón **"Informe ejecutivo con IA"**.

### 8.4 Zona (`#/equipo/631-01/zona/{AP|BW|EY}`)

- **Esquema real** con círculos de color según el estado. El crítico tiene un pulso, que se desactiva con `prefers-reduced-motion`. Etiquetas "código · L".
- **"Mover puntos"** para arrastrarlos; la posición se guarda al soltar.
- Selector de criticidad y su justificación.
- Tabla de puntos: estado, barra de límites, minigráfica con la línea Danger, tiempo a Danger y prioridad.

### 8.5 Punto (`#/punto/631-01|AP-03`), la vista más importante

- Encabezado: código, estado, prioridad, descripción, Caution y Danger. Botones "Diagnóstico con IA" y "Crear orden de trabajo"; este último se oculta con corte en el pasado o si no hay grieta.
- Aviso de color con la acción recomendada, la explicación de urgencia × consecuencia y la nota del estado.
- **Gráfica de evolución** (SVG propio):
  - Eje Horas / Fecha y alcance "Todo" / "Ciclo actual". Con corte en el pasado arranca en "Ciclo actual".
  - Bandas ámbar y roja, y líneas Caution y Danger rotuladas.
  - Puntos medidos por estado, unidos por ciclo. Ceros como círculos huecos y excluidos con una X.
  - Reparaciones como líneas punteadas y marcas N/I bajo el eje.
  - Pronóstico: línea central discontinua, banda del 90 % y **franja roja sobre Danger** entre el cruce pesimista y el optimista, con el rótulo "Danger ≈ …".
  - **Con corte en el pasado, lo medido después aparece en gris**, para comparar el pronóstico con la realidad.
  - Tooltip con fecha, horas, mm, estado, inspector, comentario y marcas.
- Cuatro cifras: llega a Caution, llega a Danger, ritmo y próxima inspección. Debajo, la nota del método.
- Columna lateral: esquema compacto, indicadores del punto y alertas.
- **Fotos:** galería con fecha y mm, ampliable. "Agregar fotos" las asocia a la última inspección. "Analizar foto" usa la IA de visión.
- **Historial del punto:** de la más reciente a la más antigua, con las marcas de calidad explicadas y la casilla Incluida / Excluida.
- OT de este punto.

### 8.6 Historial (`#/historial`)

- Filtros: equipo (si hay más de uno), zona, punto, estado (incluye "Reparada" y N/I), desde, hasta y "solo con observaciones de calidad".
- Tabla con la fila del Excel.
- **Exportar Excel** con el mismo formato de entrada (hojas Léame, Historial y Puntos).

### 8.7 Registrar inspección (`#/inspeccion/631-01`), réplica digital del Word

- **Encabezado:**
  - Fecha.
  - Equipo.
  - Horas, con un estimado = último horómetro + días × h/día. Valida que no baje y que no supere 24 h/día.
  - Inspector, con una lista de los conocidos.
  - Zonas.
- Tabla de criterios y observaciones generales.
- **Por cada zona:**
  - Tabla: código, C/D, L anterior (automática), L actual, estado (automático), N/I, Reparada, comentario y fotos.
  - Avisos "Reparar antes de continuar operando" y "Menor que la anterior sin reparación".
  - Esquema de la zona, registro fotográfico y observaciones de la zona.
- "Guardar inspección" la agrega al historial y recalcula todo. "Imprimir formato" usa estilos de papel.

### 8.8 Órdenes de trabajo (`#/ot` y `#/ot/{id}`)

Ver la sección 9.

### 8.9 Datos (`#/datos`)

- **Carga del Excel:**
  - Modo "Agregar al historial" (no duplica punto + fecha) o "Reemplazar todo".
  - Registro de cargas con advertencias.
  - Exportar historial.
  - Respaldo y restauración en JSON; el respaldo **nunca incluye la clave**.
  - "Restaurar datos originales".
- **Revisión de calidad:** conteo por tipo de marca, inspecciones con observaciones y una tabla con fila, fecha, punto, mm, explicación y la casilla incluir / excluir.
- **Criticidad de zonas:** C, justificación y esquema asignado.
- **Parámetros:**
  - Crecimiento acelerado: 15 mm por cada 100 h.
  - Cerca de Caution: 0,8.
  - Ventana de alerta: 600 h.
  - Intervalo objetivo: 700 h.
  - Capacidad: 96 h-h por semana.
  - Tarifa: 45 USD/h.
- **Límites por punto:** Caution, Danger y C propia, con aviso si son inválidos.
- **Inteligencia artificial:** indica si la IA de la plataforma está activa, y permite una clave propia opcional, elegir el modelo y "Probar conexión".
- **Biblioteca de imágenes:** subir esquemas y fotos con el nombre de la columna Imagen, ver miniaturas y un aviso si falta alguna referenciada.

---

## 9. Órdenes de trabajo (OT) e ISO 14224

Código: `src/lib/ot.ts` y `src/views/WorkOrders.tsx`.

- **Indicadores:** abiertas, backlog en h-h y en semanas, P1 abiertas y cerradas.
- **"Sugeridas por la plataforma":** puntos con grieta en P1 a P3 que no tienen OT.
- **Kanban:** Notificación → OT abierta (aprobada) → Planeada → Programada → Ejecutada → Cerrada. Queda registrada la historia de estados con fechas.
- **Documento de la OT**, editable y en las secciones del curso:
  1. **Encabezado:**
     - Tipo de mantenimiento:
       - Correctivo inmediato, si el punto es crítico, si el pesimista llega a Danger en ≤ 200 h o si es un posible crítico no verificado.
       - Preventivo basado en condición (restauración programada), si está en Alerta.
       - Monitoreo, si está en Normal.
     - Tipo de notificación: Inspección.
     - Prioridad, creación, fecha límite (antes de la fecha pesimista de Danger) y fecha programada.
     - Descripción generada con los mm, límites, estado, ritmo, pronóstico, acción, comentario del inspector y la nota de reincidente.
  2. **Objeto técnico e ISO 14224:**
     - Ubicación técnica y estado al crear.
     - Modo de falla: STD Deficiencia estructural, o BRD Avería grave si hay fractura o grieta pasante en el ciclo actual.
     - Mecanismo: 2.6 Fatiga.
     - Causa: 3.4 Desgaste esperado, o 3.3 Error de mantenimiento "presunta, a confirmar con ACR" si el punto es reincidente.
     - Detección: 3 Inspección (visual / END).
     - Actividad: 2 Reparación, u 11 Combinación si lleva refuerzo.
  3. **Operaciones**, una plantilla con k = máx(0,5; L/100):
     - Seguridad y preparación (2 personas × 1,5 h): calzar la compuerta o la caja (nunca confiar en el cilindro), LOTO, liberar la energía hidráulica, desconectar baterías y módulos, permiso en caliente y limpieza.
     - END inicial MT/PT por personal calificado (1 h).
     - Perforaciones de alivio y arco-aire hasta metal sano (1 + 0,6k h).
     - Precalentamiento y soldadura según una WPS calificada AWS D14.3 / D1.1, con electrodo de bajo hidrógeno de horno y la pinza de tierra junto a la soldadura (2 + 1,2k h).
     - Placa de refuerzo, solo si el punto es reincidente o está fracturado, con diseño aprobado por ingeniería u OEM (2 personas × (2 + 0,5k) h).
     - Esmerilado y END final 24 a 48 h después (2 personas × 1,5 h).
     - Registro y cierre (0,5 h).
     - Para un punto Normal, solo inspección y END. Para un posible crítico no verificado, primero la "verificación antes de operar".
  4. **Materiales:**
     - E7018 o el que indique la WPS, en kg: máx(2, ⌈L/150⌉ + 1).
     - Electrodos de carbón: máx(5, ⌈L/50⌉).
     - Discos, kit de END, crayones térmicos y placa de refuerzo si aplica.
  5. **Costo:** duración, h-h, mano de obra a una tarifa editable (45 USD/h), más materiales y otros, y el costo total. Es la base para el CMF (costo / facturación) y el CPMV (costo / valor de reposición).
- **Aviso visible y en la impresión:** "Plantilla de referencia, no es un procedimiento aprobado: validar contra el procedimiento del fabricante y la WPS calificada".
- **Bloqueos:** con el punto crítico, fracturado o en P1, no se puede bajar la prioridad ni diferir. Solo se puede eliminar una OT en Notificación.
- **Cierre (diálogo):**
  - Pide la fecha, que debe ser **posterior a la última medida del punto**; el horómetro, que no puede ser menor que el último; y el reporte.
  - Casilla "Registrar la reparación en el historial" y casilla "END final aceptado".
  - Con END aceptado, la OT se cierra y se agrega L = 0 reparada: el punto empieza un ciclo nuevo.
  - Con END rechazado, se registra la longitud residual y **la OT queda Ejecutada con retrabajo pendiente**.
- Imprimir / PDF con estilos de impresión.

---

## 10. Inteligencia artificial

Código: `src/lib/ai.ts`, `src/components/AIPanel.tsx` y `proxy/`.

### 10.1 Tres usos

1. **Informe ejecutivo del equipo.**
   - Contexto que recibe: indicadores, todos los puntos con estado, marcas, pronóstico con fechas y acción; hallazgos; inspecciones con sus marcas; OT; y el historial detallado.
   - Lo que pide: estado en 3 líneas, decisiones de la semana ("¿puede operar?"), riesgos y causa raíz, fallas de gestión, calidad de datos y 3 recomendaciones proactivas.
2. **Diagnóstico de un punto:** confiabilidad de la tendencia, cuándo intervenir y con qué tipo de mantenimiento, causa raíz probable, cómo evitar que reincida y una línea final con la recomendación.
3. **Análisis de foto (visión):**
   - La imagen se reduce a un máximo de 1568 px y se envía en JPEG base64.
   - Pide describir la indicación, si parece pasante, si es coherente con la medida y qué verificar en campo, y avisar si la foto no permite concluir.
   - La foto no sustituye el END ni puede mejorar el estado.

### 10.2 Mensaje de sistema

Pide a la IA actuar como un ingeniero de confiabilidad experto en integridad estructural de equipo minero, que conoce el criterio del formato y el vocabulario del curso y que señala los errores de los datos. Incluye estas **reglas de seguridad que no se negocian**:
- Nunca recomendar operar con un punto Crítico, fracturado o "posible crítico no verificado": la respuesta a "¿puede operar?" es NO.
- Una medida dudosa que indique peor condición se trata como real hasta verificarla. Nunca bajar el estado ni la prioridad calculados.
- No presentar procedimientos de soldadura como aprobados: remitir a la WPS y al fabricante. La decisión es del ingeniero responsable.
- Usar las fechas de la plataforma, no inventar datos, responder en español y en Markdown breve.

### 10.3 Panel

- Panel lateral con el Markdown renderizado por un renderizador propio que escapa todo; no se inyecta HTML.
- Las respuestas llegan en streaming.
- Botones: Regenerar, Detener, Copiar resultado, **Copiar para Claude** (el mensaje completo) e Imprimir.
- Aviso "Generado por IA: verifique cifras antes de actuar".
- Desplegable **"Ver la información que se envía"**, útil como transparencia en la exposición.

### 10.4 Modelos y parámetros

- Opus 5.5 por defecto, más Sonnet 5 y Haiku 4.5.
- `max_tokens` = 16.000 con streaming; `effort: medium`, excepto en Haiku, que no lo admite.
- Se manejan los rechazos (`stop_reason: refusal`) y las respuestas cortadas.
- Errores con mensajes en español: clave inválida, permiso, modelo inexistente, límite de consultas y sin conexión.

### 10.5 Verificado en el sitio publicado, sin clave

Los tres usos respondieron con Opus 5.5:
- **Informe:** "equipo no operable" por AP-03.
- **Diagnóstico:** confianza baja, Crítico, no operar.
- **Foto:** ubica la indicación en el pie de la soldadura de la oreja de levante y mantiene el estado Crítico.

---

## 11. Diseño visual

- **Oscuro por defecto**, sobrio, con rotulación industrial y precisión de plano técnico. Una rejilla de plano muy tenue en el fondo. Sin neón, sin brillos, sin tarjetas idénticas con sombra, sin MAYÚSCULAS espaciadas y sin flechas en los botones.
- **Tipografía**, empaquetada para funcionar sin internet: Barlow (400, 500 y 600) para la interfaz y Barlow Condensed (600 y 700) para títulos y cifras. Cifras tabulares.
- **Colores** (variables CSS):
  - Oscuro: fondo `#0e1317`, superficie `#151c21`, tinta `#ecf1f4` y acento azul de plano `#5fa1d6`.
  - Claro: fondo `#e5e9ec` y acento `#1d5c8c`.
  - Estados: Normal `#0ca30c`, Alerta `#fab219` y Crítico `#d03b3b`.
- **El color de estado siempre va con forma:**
  - Círculo lleno = Normal.
  - Triángulo = Alerta.
  - Rombo con "!" = Crítico.
  - Círculo hueco = Sin grieta.
  - Círculo punteado = N/I.
- **Prioridad:** P1 rojo sólido, P2 borde rojo, P3 borde ámbar y P4 gris.
- **Esquemas:** sobre fondo blanco; en oscuro se invierten con `invert(.88) hue-rotate(180deg)`.
- **Composición:** paneles con borde de 1 px y radio de 10 px, indicadores en una sola franja dividida, ancho máximo de 1360 px y contenido alineado a la izquierda.
- **Accesibilidad e impresión:** funciona en celular en una columna, sin desplazamiento horizontal de la página; foco visible con el teclado; estilos de impresión para la OT y el formato de inspección.
- **Modelo 3D (Three.js):** representación simplificada con primitivas, según la geometría de la sección 7 del prompt.
  - Puntos como esferas de color, con un halo pulsante en Alerta y Crítico.
  - Etiquetas atenuadas cuando el punto queda tapado por la estructura.
  - Casilla "Caja transparente" para ver el eyector.
  - Se revisó con capturas desde 3 ángulos.

---

## 12. Arquitectura técnica y archivos

**Stack:**
- Vite 8, React 18 y TypeScript estricto.
- SheetJS 0.20.3, instalado desde el CDN oficial porque la versión de npm tiene vulnerabilidades.
- Three.js, zustand, idb-keyval, @fontsource y el SDK de Anthropic, que se carga bajo demanda.
- Gráficas en SVG propio.
- Desarrollo: tsx y Playwright.
- `vite.config.ts` con `base: './'`.

**Datos guardados:** en IndexedDB del navegador. La base completa va en una clave y cada imagen como Blob en `img:{nombre}`. El tema se guarda en `localStorage`. Todo acceso al almacenamiento va en try/catch.

```
Taller-en-enfasis-/
├── PROMPT_CLAUDE_CODE.md          encargo original
├── README.md                      documentación pública
├── contexto tarea corte 2.md      este documento
├── curso/                         presentaciones semanas 1–5 (material de apoyo, no se publica en la app)
├── reto/                          enunciado del profesor (.pptx)
├── datos-fuente/                  Excel y Word originales
├── public/
│   ├── favicon.svg
│   └── data/                      Excel incluido, esquemas y foto (los carga la app)
├── src/
│   ├── main.tsx, App.tsx          entrada, barra superior, rutas
│   ├── types.ts                   Unit, Zone, Point, InspectionEvent, Inspection, WorkOrder, Settings, DB
│   ├── store.ts                   zustand + IndexedDB + imágenes (useImage, saveImage)
│   ├── router.ts                  rutas por hash y ?corte=
│   ├── hooks.ts                   useAnalysis (análisis memoizado por base y corte)
│   ├── styles.css                 tokens de diseño, componentes, impresión
│   ├── lib/
│   │   ├── catalog.ts             coordenadas 2D/3D, criticidades, imágenes incluidas, modelos IA, URL del intermediario
│   │   ├── importer.ts            parseWorkbook, mergeImport, exportWorkbook, detección de reparación y fractura
│   │   ├── quality.ts             runQuality (marcas y exclusiones), ritmo típico
│   │   ├── analysis.ts            estado, ciclos, ajuste, pronóstico, prioridad, alertas, indicadores, hallazgos, analyze()
│   │   ├── ot.ts                  createWorkOrder, plantillas, ISO 14224, flujo, closeWO
│   │   └── ai.ts                  mensaje de sistema, contextos, askClaude (streaming), mensajes de error
│   ├── components/                Timeline, GrowthChart, HeatHistory, Schematic, Scraper3D (+Lazy3D),
│   │                              Ranking, RiskMatrix, Findings, AIPanel, ui
│   └── views/                     Fleet, Unit, Zone, Point, History, WorkOrders, InspectionForm, Data
├── tools/
│   ├── probar-motor.ts            37 pruebas de aceptación (sección 4)
│   ├── flujo.ts                   prueba en navegador: OT completa, máquina del tiempo, inspección, restaurar
│   └── capturas.ts                capturas de todas las rutas en oscuro, claro y celular
├── proxy/                         intermediario de IA (proyecto Vercel aparte)
│   ├── api/v1/messages.ts         función: valida y reenvía a Anthropic con la clave secreta
│   ├── lib/system.ts              copia del mensaje de sistema
│   ├── vercel.json, package.json, README.md
└── .github/workflows/deploy.yml   GitHub Actions: pruebas del motor → build → GitHub Pages
```

---

## 13. Pruebas y verificación

| Prueba | Comando | Resultado |
|---|---|---|
| Aceptación del motor (sección 3 del encargo, más seguridad y "sin mirar al futuro") | `npx tsx tools/probar-motor.ts` | **37 correctas, 0 fallas** |
| Tabla y hallazgos a cualquier corte | `npx tsx tools/probar-motor.ts 2024-04-30` | Usada para revisar |
| Flujo en el navegador | `npx tsx tools/flujo.ts [url]` | **14 de 14** en local y en el sitio publicado |
| Capturas | `npx tsx tools/capturas.ts [url]` | 9 pantallas × 3 variantes, sin errores en consola ni desplazamiento horizontal |
| Escenarios de borde del revisor (8) | Script del revisor | Todos correctos después de las correcciones |
| Tipos | `npx tsc --noEmit -p .` | Sin errores |
| Build bajo una subruta como en Pages | `npm run build` | Cargan el Excel, las imágenes y las fuentes |
| IA en el sitio publicado, sin clave | Prueba en el navegador | Informe, diagnóstico y foto responden |
| Intermediario | `curl` | Responde desde la página; rechaza otros sitios (403) y modelos no permitidos |

El flujo cubre:
1. Crear la OT de AP-03, que queda Correctivo inmediato y BRD.
2. Avanzarla por todos los estados y cerrarla con reparación: AP-03 queda Sin grieta, con 2 reparaciones, y la OT en Cerrada.
3. La máquina del tiempo al 2024-04-30: Alerta, P1, Danger en 325 h (115 – 551) y Crear OT oculto.
4. Volver al presente.
5. Una inspección de prueba (AP-02 = 120 mm, Normal).
6. Restaurar los datos originales.
7. Cero errores en consola.

---

## 14. Publicación y despliegue

### Sitio (GitHub Pages)

- El workflow `.github/workflows/deploy.yml` corre en cada push a `main`:
  1. `npm ci`.
  2. **`npx tsx tools/probar-motor.ts`**: si falla, no se publica.
  3. `npm run build`.
  4. Sube `dist` a Pages.
- Pages se activó con `gh api -X POST repos/jdvc2409/Taller-en-enfasis-/pages -f build_type=workflow`.
- `gh` está instalado como binario en `~/.local/bin`, con sesión iniciada como jdvc2409.

### Intermediario de IA (Vercel)

- Es un proyecto aparte, `integridad-estructural-ia`, en la carpeta `proxy/`. La cuenta de Vercel quedó con sesión iniciada en la CLI.
- La clave está guardada como variable de entorno **secreta** `ANTHROPIC_API_KEY` (Production, "Sensitive"). No es visible ni en la CLI.
- Para redesplegar: `cd proxy && npx vercel deploy --prod --yes`.
- La URL que usa la app está en `src/lib/catalog.ts` → `AI_PROXY = 'https://integridad-estructural-ia.vercel.app/api'`.

### Cómo correr localmente

```bash
npm install
npm run dev                         # http://localhost:5173 (también usa el intermediario: localhost está permitido)
npx playwright install chromium     # una vez, para flujo.ts y capturas.ts
```

---

## 15. Seguridad de la clave de API

**Qué se pidió:** que cualquier persona pueda preguntar a la IA desde el link sin pegar una clave.

**Por qué no se metió la clave en el código:**
- El sitio y el repositorio son públicos: cualquiera podría copiar la clave y gastar el saldo.
- GitHub revisa los repositorios públicos en busca de claves de Anthropic, y la clave se revocaría en minutos.

**Solución aplicada:** un intermediario en Vercel. La página le pregunta al intermediario y el intermediario le pregunta a Claude con la clave guardada como secreto. Restricciones del intermediario:
- Solo acepta el origen `https://jdvc2409.github.io`, más localhost para desarrollo.
- Solo permite los modelos `claude-opus-5-5`, `claude-sonnet-5` y `claude-haiku-4-5`, y una sola pregunta de usuario por consulta.
- Respuestas de 16.000 tokens como máximo y consultas de 4 MB como máximo.
- **Siempre usa su propio mensaje de sistema**, el de la plataforma, así que la clave no sirve como un chat general.
- Admite 25 consultas por IP cada 10 minutos, por instancia.

**Verificaciones:**
- La clave no está en ningún archivo del repositorio, ni en la página publicada, ni en los archivos locales. Se buscó explícitamente.
- La clave solo se usó por la entrada estándar (para guardarla en Vercel) y en pruebas con navegadores temporales que se borraron.

**Límites conocidos:**
- El filtro por origen detiene a otros sitios web, pero no a alguien con conocimientos técnicos que falsifique el encabezado desde fuera del navegador. En ese caso lo que limita el gasto es el tope de consultas.
- **Todo el consumo se cobra en la cuenta de Anthropic de la persona.** Un informe con Opus 5.5 cuesta unos pocos centavos de dólar; con Sonnet 5 o Haiku 4.5 cuesta menos.

**Recomendación:** **revocar la clave después del 10 de octubre de 2026** desde la consola de Anthropic. Se escribió en el chat de desarrollo y quedó en ese historial. Si se quiere mantener la IA después, se crea una clave nueva y se reemplaza en Vercel con `vercel env rm` y `vercel env add`.

**Opcional:** cada persona puede usar una clave propia en Datos → IA. Queda solo en su navegador y el respaldo JSON nunca la incluye.

---

## 16. Guía para la exposición

### Antes

- Abrir https://jdvc2409.github.io/Taller-en-enfasis-/. Si en el ensayo se registraron inspecciones u OT de prueba: **Datos → Restaurar datos originales**.
- Opcional: probar la IA con Datos → IA → "Probar conexión".
- Tener a mano el enlace directo de la máquina del tiempo: `https://jdvc2409.github.io/Taller-en-enfasis-/#/punto/631-01%7CAP-03?corte=2024-04-30`

### Recorrido sugerido (unos 10 minutos)

1. **Problema** (30 s): 300 registros en 3 años, con datos de campo que tienen errores. Hay que llegar a decisiones.
2. **Flota:** "Qué atender primero" muestra AP-03 en P1, Crítico, "Reparar antes de continuar operando". Señalar los indicadores (3.350 h con un punto crítico confirmado) y la matriz de riesgo.
3. **Equipo:** el mapa de calor muestra toda la historia de un vistazo (reparaciones, N/I, intervalos en ámbar). El modelo 3D muestra dónde está cada punto. Leer dos o tres hallazgos: el intervalo largo con un punto crítico ("debió acortarse, no alargarse"), los reincidentes y la campaña de reparación seguida de crecimientos atípicos.
4. **Punto AP-03:** la gráfica con Caution y Danger, los episodios sobre Danger, la fractura y la foto.
5. **Máquina del tiempo (pieza central):**
   - Arrastrar al 30 abr 2024, o abrir el enlace directo.
   - AP-03 tenía 380 mm, en Alerta, y la plataforma ya decía **P1: "reparar ya o restringir", Danger en 325 h (115 – 551)**.
   - En gris aparece lo que pasó: 685 h después midió 410 mm, sobre Danger, y siguió creciendo hasta ser pasante. **"La plataforma lo habría anticipado."**
6. **Decisión → acción:** "Crear OT" genera el documento ISO 14224, con las operaciones de seguridad y el costo. Recorrer el kanban, es decir, el ciclo de la OT del curso.
7. **IA:**
   - "Informe ejecutivo con IA": responde que el equipo no puede operar y da decisiones con plazos.
   - Mostrar "Ver la información que se envía" como transparencia.
   - Opcional: "Analizar foto" de AP-03.
8. **Calidad de datos:** en Datos → Revisión de calidad, el atípico de BW-03 excluido, las bajas sin reparación y las inspecciones parciales. "Los datos vienen de campo."
9. **Cierre:** la plataforma no solo muestra datos; dice qué hacer, cuándo y por qué, con el criterio del formato y el vocabulario del curso.

### Preguntas probables

- **¿Por qué un ajuste lineal?** Se eligen el lineal o el exponencial por su error. El exponencial se justifica con la ley de Paris. En AP-03, el lineal tiene R² = 0,996 y error 145 frente a 793 del exponencial.
- **¿Por qué la banda?** Es una predicción del 90 % con t de Student. La urgencia usa el escenario pesimista porque es conservador.
- **¿Por qué la próxima inspección es la mitad?** Es la regla de tolerancia al daño: da dos oportunidades de detectar la grieta antes del límite.
- **MTBF:** el encargo pide horas / reparaciones ≈ 716 h. El curso define el MTBF con fallas, y con 3 fallas da ≈ 5.726 h. Se muestran ambos.
- **¿La IA puede equivocarse?** Sí. Por eso tiene reglas de seguridad, el aviso "verifique cifras" y la transparencia de lo que se envía. La decisión es del ingeniero.

---

## 17. Mantenimiento y operación

- **Cambiar datos:** Datos → Cargar Excel ("Agregar" o "Reemplazar"). El Excel debe tener columnas con nombres parecidos.
- **Cambiar umbrales, criticidades o límites:** en Datos. Se guardan en el navegador de quien los cambie, no para todos los visitantes.
- **Cambiar el Excel incluido para todos:** reemplazar `public/data/631G_historial_grietas.xlsx`, hacer commit y push. Los visitantes que ya entraron ven su copia guardada hasta usar "Restaurar datos originales".
- **Cambiar el mensaje de sistema de la IA:** editar `src/lib/ai.ts` **y** copiarlo a `proxy/lib/system.ts`. Luego `cd proxy && npx vercel deploy --prod --yes` y push.
- **Cambiar la clave:** `cd proxy && npx vercel env rm ANTHROPIC_API_KEY production` y después `npx vercel env add ANTHROPIC_API_KEY production --sensitive`, con un redespliegue.
- **Volver a probar:** `npx tsx tools/probar-motor.ts`, `npx tsx tools/flujo.ts https://jdvc2409.github.io/Taller-en-enfasis-/` y `npx tsx tools/capturas.ts`.
- **Respaldo:** Datos → Respaldo JSON (no incluye la clave).

---

## 18. Historial de trabajo (commits)

| Commit | Contenido |
|---|---|
| 5f08fd3 | Material del encargo: enunciado, curso y datos fuente |
| f28ce13 | Motor de análisis: importador, calidad de datos, pronóstico y pruebas de aceptación |
| ffeb873 | Motor: correcciones de seguridad de la revisión independiente |
| 90bcf02 | Interfaz: base oscura, rutas, persistencia, máquina del tiempo y vista Flota |
| 6febcdc | Vista Equipo: mapa de calor, modelo 3D y hallazgos; IA con el SDK oficial |
| 01acdbb | Vista Punto: gráfica con pronóstico y lo que pasó después, fotos, historial, corte en el enlace |
| 3c572df | Vista Zona: esquema con marcadores, mover puntos, criticidad y minigráficas |
| 431aa23 | Órdenes de trabajo: sugeridas, kanban, documento ISO 14224, cierre con END; prueba de flujo |
| 6d67683 | Formulario de inspección, Historial y Datos; OT e IA endurecidas por la revisión |
| d452b42 | 3D: etiquetas ocultas atenuadas; márgenes de la gráfica en celular |
| 3901380 | README, despliegue en Pages con pruebas del motor, SDK de IA bajo demanda |
| 52f410e | Intermediario de IA en Vercel |
| cb254a4 | IA de la plataforma activa para todos |
| eae5014 | README: IA mediante el intermediario |

Resumen del proceso:
1. Se revisaron el Excel y el Word contra el encargo.
2. Se construyó y validó el motor antes de cualquier interfaz.
3. Se corrigió por seguridad con la revisión independiente.
4. Se construyeron las vistas, revisando cada una con capturas.
5. Se probó el flujo completo.
6. Se publicó en Pages.
7. Se probó la IA real.
8. Se integró el intermediario para que la IA funcione para cualquiera.

---

## 19. Pendientes y recomendaciones

- [ ] **Revocar la clave de Anthropic después del 10 de octubre de 2026**, o reemplazarla (sección 15).
- [ ] Ensayar la exposición con el recorrido de la sección 16 y usar "Restaurar datos originales" antes de presentar.
- [ ] Opcional: bajar el costo de la IA usando Sonnet 5 como modelo por defecto (Datos → IA, o `DEFAULT_SETTINGS.aiModel` en `catalog.ts`).
- [ ] Opcional: limitar el gasto mensual desde la consola de Anthropic.
- [ ] Aviso menor de GitHub Actions: las acciones v4 usan Node 20, que está en desuso. Hoy funcionan; más adelante conviene actualizar a las versiones nuevas de `actions/checkout`, `setup-node` y `upload-pages-artifact`.
- **Advertencias de uso:**
  - Los tiempos y materiales de la OT son una **plantilla de referencia, no un procedimiento aprobado**.
  - El modelo 3D es una representación simplificada.
  - Los pronósticos son estimaciones estadísticas sobre datos de campo: la decisión final es del ingeniero responsable.
