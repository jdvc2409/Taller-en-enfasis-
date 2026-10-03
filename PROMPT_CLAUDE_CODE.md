# Encargo para Claude Code: Plataforma de Integridad Estructural — Traílla CAT 631G

> **Cómo usar este archivo.** Guárdalo en la raíz del repositorio como `PROMPT_CLAUDE_CODE.md`, abre una terminal en esa carpeta, ejecuta `claude` y escribe:
> *"Lee PROMPT_CLAUDE_CODE.md completo y construye la plataforma siguiendo sus fases. Antes de programar, entra en modo plan y muéstrame el plan."*

---

## 0. Preparar el computador (Zorin OS) — lo hace la persona, una sola vez

```bash
# Herramientas básicas
sudo apt update && sudo apt install -y git curl python3 python3-pip gh

# Node 22 con nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22

# Claude Code (si el comando cambió, ver https://docs.claude.com/en/docs/claude-code/overview)
npm install -g @anthropic-ai/claude-code

# Iniciar sesión en GitHub para poder subir el código
gh auth login

# Clonar el repositorio y preparar la carpeta de datos
git clone https://github.com/jdvc2409/Taller-en-enfasis-.git
cd Taller-en-enfasis-
mkdir -p datos-fuente
# Copia aquí: 631G_historial_grietas.xlsx y 631G_formato_inspeccion.docx
cp ~/Descargas/631G_historial_grietas.xlsx ~/Descargas/631G_formato_inspeccion.docx datos-fuente/
claude
```

Dentro de Claude Code usa el modelo más potente disponible (`/model` → Opus).

---

## 1. Contexto del encargo

Trabajo del segundo corte de **Gestión del Mantenimiento** (Universidad de La Sabana). El enunciado:

> Durante los últimos dos años se han generado miles de datos producto de las inspecciones estructurales de los equipos de una flota. El desafío es convertir esos datos en conocimiento. Diseñe y construya una plataforma digital que permita **navegar desde la visión global de la flota hasta el historial de una grieta específica**, integrando datos, imágenes, tendencias e indicadores. La solución deberá ser gráfica, interactiva, intuitiva y **orientada a la toma de decisiones de mantenimiento**. La IA está permitida y se invita a usarla. Una herramienta sofisticada que no ayuda a tomar mejores decisiones de mantenimiento no resuelve el problema.
>
> "Los datos vienen de campo: revísenlos antes de confiar en ellos."

**Requisitos mínimos del profesor (todos obligatorios):**

1. **Cargar datos:** leer el historial en Excel sin transcribirlo a mano.
2. **Historial completo:** guardar cada inspección nueva junto con las anteriores.
3. **Tendencia por punto:** evolución de cada grieta contra fecha y contra horas, con las líneas Caution y Danger.
4. **Imágenes:** esquema de la zona y fotos asociadas a cada punto.
5. **Alertas:** avisar si un punto se acerca a su límite, lo pasa o crece muy rápido.
6. **Registrar y consultar:** nuevas inspecciones con su estado; filtros por zona, punto y fecha.

**Uso de IA obligatorio** dentro de la plataforma.

**Diferenciadores elegidos** (además de los mínimos):

- **Pronóstico de cada grieta:** horas y fecha estimada para llegar a Caution y Danger, con banda de incertidumbre.
- **Ranking de prioridad:** urgencia × consecuencia, con la lista de qué atender primero.
- **Orden de trabajo automática** con clasificación ISO 14224 y backlog.
- **Esquema 2D interactivo** sobre los esquemas reales, más un **modelo 3D** simplificado con los puntos coloreados por estado.
- **Máquina del tiempo:** ver la plataforma tal como estaba en cualquier inspección pasada y comparar el pronóstico con lo que pasó después. Es la pieza más fuerte para la exposición.

**Decisiones ya tomadas con la persona:**

- **Alcance de los datos:** el trabajo es individual y hay un solo equipo (631-01). La plataforma debe funcionar para N equipos, pero se muestra solo con los datos reales. **No inventar equipos ni datos.**
- **Entrega:** exposición en vivo y además un link. Fecha: sábado 10 de octubre de 2026.
- **Publicación:** GitHub Pages en `jdvc2409/Taller-en-enfasis-`.
- **IA:** la persona tiene una clave de API de Anthropic. **La clave nunca va en el código ni en el repositorio** (es público). Se pega en la configuración de la app y se guarda solo en el navegador.

Vocabulario del curso que la plataforma debe usar donde aplique: mantenimiento preventivo basado en condición vs. correctivo (diferido / inmediato), planeación ("¿qué?") vs. programación ("¿cuándo?"), ciclo de la OT (Notificación → Aprobación / OT abierta → Planeación → Programación → Ejecución → Reporte → Cierre), MTBF, backlog, criticidad (probabilidad × consecuencia), análisis de causa raíz, mantenimiento proactivo, ISO 14224.

---

## 2. Los datos (están en `datos-fuente/`)

Material de apoyo en el repositorio, para consultar cuando haga falta:

- `reto/Plataforma_Gestion_Estructural_IA.pptx`: el enunciado original del profesor.
- `curso/`: las presentaciones de las semanas 1 a 5 del curso. Úsalas para que el vocabulario y los indicadores (tipos de mantenimiento, ciclo de la OT, MTBF, backlog, criticidad) coincidan con lo que vio el curso.

Esas carpetas no son parte de la app: no las copies a `public/`.

### 2.1 `631G_historial_grietas.xlsx`

**Hoja `Léame`** (filas clave/valor en las columnas A y B): `Flota = Traílla 631G`, `Equipo = 631-01`, periodo 2023-02-06 a 2026-02-05, 25 inspecciones, 3 zonas y 12 puntos. Define:

- `L actual (mm)`: longitud medida; **0 = sin grieta detectable**.
- **Celda vacía = punto no inspeccionado (N/I)**. Nunca convertir N/I en 0.
- Criterio de estado: **Normal** L < Caution; **Alerta** Caution ≤ L < Danger; **Crítico** L ≥ Danger.
- Horas = horómetro acumulado del equipo.
- Imagen = nombre del esquema o de la foto.

**Hoja `Historial`** (300 filas): columnas `Fecha | Equipo | Horas (h) | Inspector | Zona | Código | Descripción | L actual (mm) | Comentario | Imagen`.

- Fechas tipo fecha de Excel; horas decimales (p. ej. 39096.9).
- Inspectores: INSP-01, INSP-02, INSP-03.
- Zonas: `Apron (compuerta delantera)`, `Caja (scraper bowl)`, `Eyector`.
- Una reparación se registra como `L = 0` con el comentario **"Zona reparada por soldadura"**. Hay 24.
- Otros comentarios: `"Grieta pasante en la base del soporte"` (AP-03, 2024-10-01) y `"Fractura. Equipo no debe operar hasta reparar"` (AP-03, 2026-02-05).
- Imagen: `631_BW_caja_bowl.png`, `631_EY_eyector.png`, `631_AP_apron.png`, y una foto: `631_AP-03_2026-02-05.jpg`.

**Hoja `Puntos`**: `Código | Zona | Descripción | Caution (mm) | Danger (mm) | Esquema`

| Código | Descripción | Caution | Danger |
|---|---|---|---|
| BW-01 | Borde superior delantero izquierdo de la caja | 400 | 800 |
| BW-02 | Tubo transversal superior y travesaño del piso | 800 | 1500 |
| BW-03 | Pared lateral derecha, cara interna | 1000 | 2000 |
| BW-04 | Lateral izquierdo, parte inferior externa | 1000 | 2000 |
| EY-01 | Placa de empuje del eyector | 400 | 800 |
| EY-02 | Unión de los brazos con la placa de empuje | 250 | 400 |
| EY-03 | Brazos del bastidor del eyector | 400 | 700 |
| EY-04 | Soporte del cilindro del eyector | 150 | 300 |
| AP-01 | Oreja de pivote izquierda del apron | 200 | 400 |
| AP-02 | Placa lateral izquierda del apron | 250 | 500 |
| AP-03 | Soporte central (oreja de levante) del apron | 200 | 400 |
| AP-04 | Placa frontal inferior del apron | 300 | 600 |

**El importador debe reconocer columnas por nombre** (sin importar mayúsculas, tildes ni el orden), ignorar columnas como "L anterior", aceptar fechas como fecha de Excel, número serial o texto `dd/mm/aaaa` / `aaaa-mm-dd`, y aceptar decimales con coma. Debe funcionar con otro Excel de estructura parecida (otra flota u otros equipos).

> Ojo con las fechas de SheetJS: con `cellDates:true` pueden llegar como medianoche local o UTC con segundos de deriva. Sumar 12 h al timestamp y leer los componentes locales da el día correcto.

### 2.2 `631G_formato_inspeccion.docx`

Es el formato de campo que la plataforma debe replicar digitalmente:

- **Encabezado:** FECHA, EQUIPO, HORAS, INSPECTOR, ZONAS. Nota: "con el equipo armado algunas áreas quedan ocultas y no son inspeccionables".
- **Tabla de criterios:**
  - Normal: seguimiento en la frecuencia normal.
  - Alerta: aumentar frecuencia de inspección y programar reparación.
  - Crítico: reparar antes de continuar operando.
  - N/I: no inspeccionado por acceso, limpieza deficiente o fuera de programación.
- **Observaciones generales.**
- **Por cada zona:**
  - Tabla `Código | Descripción | Caution | Danger | L anterior | L actual | Estado | Comentario`.
  - "Ubicación de los puntos de inspección" (esquema).
  - "Registro fotográfico" (foto, punto, fecha).
  - "Observaciones de la zona".

**Imágenes dentro del .docx** (descomprimir `word/media/`):

| Archivo en el docx | Guardar como | Contenido |
|---|---|---|
| `image1.png` (1680×1140) | `public/data/esquemas/631_BW_caja_bowl.png` | Esquema Caja con flechas BW-01…04 |
| `image2.png` (1900×1240) | `public/data/esquemas/631_EY_eyector.png` | Esquema Eyector con flechas EY-01…04 |
| `image3.png` (2240×1140) | `public/data/esquemas/631_AP_apron.png` | Esquema Apron con flechas AP-01…04 |
| `image4.png` (604×453) | `public/data/fotos/631_AP-03_2026-02-05.jpg` | Foto de la fractura AP-03 |

Copia también el Excel a `public/data/631G_historial_grietas.xlsx`. La app lo carga sola en la primera visita, para que el profesor vea datos al abrir el link.

**Posición de cada punto sobre su esquema** (fracción del ancho y alto de la imagen, medida en la punta de la flecha principal; editable en la app arrastrando el punto):

```
BW-01 (0.075, 0.247)  BW-02 (0.607, 0.400)  BW-03 (0.768, 0.505)  BW-04 (0.393, 0.784)
EY-01 (0.382, 0.226)  EY-02 (0.429, 0.372)  EY-03 (0.279, 0.635)  EY-04 (0.529, 0.523)
AP-01 (0.491, 0.306)  AP-02 (0.559, 0.248)  AP-03 (0.704, 0.463)  AP-04 (0.600, 0.516)
```

Verifícalas dibujándolas sobre las imágenes y viendo el resultado. **El centro del círculo, no el centro del conjunto círculo + etiqueta, debe caer sobre la coordenada.**

---

## 3. Lo que los datos deben mostrar (pruebas de aceptación del motor)

Antes de cualquier interfaz, crea `tools/probar-motor.ts` (se corre con `npx tsx tools/probar-motor.ts [fecha-corte]`). Debe leer el Excel real con el mismo código de la app e imprimir estos resultados, con una tolerancia de ±1 % en horas:

**Al corte de la última inspección (2026-02-05):**

| Resultado | Valor esperado |
|---|---|
| Registros, equipos, zonas, puntos, inspecciones | 300, 1, 3, 12, 25 |
| Horómetro al corte | 55.696,5 h |
| Uso promedio | ≈ 15,7 h/día |
| Celdas N/I | 20 |
| Reparaciones | 24 |
| MTBF estructural | (55.696,5 − 38.520) / 24 ≈ **716 h** |
| Estado de AP-03 | **Crítico**, 400 mm, prioridad **P1** |
| Estado de los otros 11 puntos | Sin grieta |
| Horas de AP-03 sobre Danger | **al menos 3.350 h confirmadas** (de la primera a la última medida crítica de cada episodio) y **hasta 4.585 h** (hasta el registro de la reparación o el corte), en 2 episodios |
| BW-04 | superó Danger (2.200 mm el 2025-06-29) y la reparación se registró **1.922 h** después |
| Intervalos largos | 2025-10-20 (113 días, 1.922 h) y 2026-02-05 (108 días, 1.533 h), contra una mediana de 41 días. Ocurrieron **mientras AP-03 estaba crítica** |
| Inspecciones parciales | 2024-10-01 (solo Apron) y 2024-10-31 (solo Caja): 8 de 12 puntos N/I |
| Valor atípico excluido | **BW-03 2023-12-02 = 290 mm** (entre 720 y 1.030 sin reparación) |
| Bajas sin reparación | AP-04 2025-06-29: 540 → 400 (advertencia). BW-01 660 → 600 y EY-03 570 → 540 (variación de medición ≤ 15 %, solo informativas) |
| Crecimiento atípico | BW-02 250 → 1.100 mm, BW-03 0 → 1.800 mm y BW-04 0 → 2.200 mm, todos en ~600 h, después de la reparación masiva |
| Campaña de reparación | **2025-01-27**: 8 puntos reparados en una parada |
| Ritmo típico de crecimiento | mediana ≈ 6 mm por cada 100 h |
| Reincidentes (≥ 2 reparaciones) | AP-02, AP-04, BW-01, BW-02, BW-03, BW-04, EY-02, EY-03 |
| Inspecciones a tiempo | ≈ 71 % (intervalo objetivo ≤ 700 h) |

**Máquina del tiempo, corte 2024-04-30** (la diapositiva estrella de la exposición):

- AP-03 = 380 mm, en **Alerta**, prioridad **P1**.
- Ajuste lineal con 6 medidas, ≈ 7,7 mm por cada 100 h.
- **Danger en ≈ 325 h** (pesimista ≈ 115 h, optimista ≈ 551 h).
- En la realidad, la siguiente inspección (685 h después) ya midió 410 mm, sobre Danger. La plataforma lo habría anticipado.

**Corte 2024-06-10:** AP-03 = 410 mm, Crítico. BW-01 500 mm, BW-04 1.080 mm y EY-03 460 mm en Alerta.

Si el motor no reproduce estos valores, corrígelo antes de seguir.

---

## 4. Reglas de cálculo (motor de análisis)

Todo el análisis se recalcula a partir de los datos y de una **fecha de corte** opcional (la máquina del tiempo). Con fecha de corte, solo cuentan las inspecciones con fecha ≤ corte. La hora "actual" es el horómetro de la última inspección del equipo hasta el corte.

### 4.1 Estado

| Estado | Condición |
|---|---|
| `ni` | L vacía |
| `sin` | L = 0 |
| `critico` | L ≥ Danger |
| `alerta` | L ≥ Caution |
| `normal` | resto |

El estado actual del punto usa la última medida válida, y se marca si la última inspección fue N/I.

### 4.2 Calidad de datos (marcas por registro; se recalculan con cada cambio)

- **`atipico`** (advertencia, se **excluye** del pronóstico): L baja más de 30 % frente a la última medida confiable, sin reparación, y la siguiente medida vuelve a ≥ 90 % de la anterior. No actualiza la "última confiable".
- **`baja-leve`** (informativa): baja ≤ 15 % sin reparación (dispersión de medición).
- **`baja`** (advertencia): cualquier otra baja sin reparación, incluida una grieta que pasa a 0 sin comentario de reparación.
- **`salto`** (advertencia, se mantiene): crecimiento mayor que max(100, 4 × mediana del equipo) mm por cada 100 h respecto a la última medida confiable.
- **`repara-sin-grieta`**: reparación registrada cuando la medida anterior era 0.
- **Por inspección (encabezado):**
  - `horometro`: retrocede o supera 24 h/día. Error; excluye las medidas de esa inspección.
  - `intervalo`: horas desde la anterior > 1,5 × intervalo objetivo (700 h), o días > 2 × la mediana.
  - `parcial`: hay puntos N/I. Es advertencia si son la mitad o más.
- El usuario puede **incluir o excluir manualmente** cualquier medida (`override`), y su decisión prevalece sobre la automática.

### 4.3 Ciclos y pronóstico

- **Ciclos:** el historial de cada punto se parte en ciclos separados por reparaciones. El pronóstico usa solo el **ciclo actual**, con medidas > 0, no excluidas y con horómetro.
- **Con 3 o más medidas:**
  - Ajustar un modelo **lineal** L = a + b·h y uno **exponencial** ln L = a + b·h, con h medida desde la primera medida.
  - Elegir el exponencial solo si su error cuadrático en mm es menor que 0,9 × el del lineal y b > 0.
  - El exponencial se justifica con la **ley de Paris** (da/dN ∝ ΔK^m; con m ≈ 2 la grieta crece exponencialmente).
  - **Banda de predicción del 90 %:** t de Student con gl = n − 2, **limitada a 3** (con n = 3 la t vale 6,3 y la banda explota).
  - Piso del error residual = 5 mm, la resolución de la medida. En log, 5 / L promedio.
- **Con 2 medidas:** lineal entre ambas, con banda ×0,6 a ×1,6 del ritmo y confianza baja.
- **Con 1 medida:** se proyecta con el ritmo histórico del punto (mediana de ciclos anteriores) o, si no hay, el típico del equipo, con banda ×0,5 a ×2.
- **Pendiente ≤ 0:** grieta estable, sin cruce.
- **Horas hasta Caution y Danger:**
  - Central: la curva central cruza el límite.
  - Pesimista: el borde superior de la banda cruza el límite.
  - Optimista: el borde inferior cruza el límite.
  - Se busca hasta 15.000 h hacia adelante.
- **Convertir horas a fecha** con el uso del equipo en h/día: (último horómetro − primero) / días entre ambas inspecciones.
- **Ritmo actual (mm por cada 100 h):** b × 100 en el lineal; b × L × 100 en el exponencial.

### 4.4 Prioridad = urgencia × consecuencia

**Consecuencia C** = criticidad de la zona, editable:

| Zona | C | Razón |
|---|---|---|
| Caja | 5 | Estructura portante |
| Apron | 4 | La oreja de levante o el pivote pueden dejar caer la compuerta; riesgo de seguridad |
| Eyector | 3 | Afecta productividad |

**Urgencia P** según T = horas pesimistas hasta Danger:

| Condición | P |
|---|---|
| Crítico | 5 |
| T ≤ 250 | 5 |
| T ≤ 500 | 4 |
| T ≤ 1000 | 3 |
| T ≤ 2500 | 2 |
| resto | 1 |

Mínimos: Alerta → P ≥ 3; Normal con grieta → P ≥ 2.

**Prioridad:**

| Prioridad | Nombre | Condición |
|---|---|---|
| P1 | Inmediata | Crítico o P×C ≥ 20 |
| P2 | Esta semana | P×C ≥ 12 |
| P3 | Próximo mes | P×C ≥ 6 |
| P4 | Seguimiento | resto |

**Acción recomendada** (en las palabras del formato):

- **Crítico:** "Reparar antes de continuar operando (sacar de servicio)".
- **Alerta:** "Programar reparación antes de {T} h y reinspeccionar en ≤ {X} h".
- **Normal:** "Seguimiento: reinspeccionar en ≤ {X} h".
- **Sin grieta y reincidente:** "análisis de causa raíz antes de la próxima reparación".

**Próxima inspección** = la mitad del tiempo restante (regla de tolerancia al daño), entre 100 h y el intervalo objetivo.

### 4.5 Alertas por punto

- Supera Danger.
- En Alerta.
- **Cerca de Caution** (≥ 80 %).
- **Crece rápido** (≥ 15 mm por cada 100 h).
- **Puede llegar a Danger en < 600 h** (escenario pesimista).
- No inspeccionado en la última inspección.
- Sin medición hace más de 1,5 × el intervalo objetivo.
- **Reincidente** (≥ 2 reparaciones).

Todos los umbrales se pueden editar en Datos.

### 4.6 Indicadores

**Por punto:**

- Reparaciones.
- Una reparación cada X h.
- Tiempo medio hasta reaparecer tras reparar.
- Vida media de la grieta (de la detección a la reparación).
- Horas sobre Danger (confirmadas y máximas).

**Por equipo:**

- Conteo por estado.
- Reparaciones y MTBF estructural (horas observadas / reparaciones).
- **Horas operando con al menos un punto crítico.**
- **% de inspecciones a tiempo.**

**Órdenes de trabajo:**

- Backlog en h-hombre (OT no ejecutadas ni cerradas).
- Backlog en semanas (capacidad editable: 96 h-hombre por semana).

### 4.7 Hallazgos automáticos (texto para decidir, ordenados por severidad)

1. Puntos que operaron sobre Danger, con las horas confirmadas y máximas, y si hoy siguen críticos. Cita el criterio del formato.
2. **Un solo hallazgo agrupado** de puntos reincidentes, con reparaciones y tiempo medio hasta reaparecer, que recomiende análisis de falla, refuerzo o cambio de procedimiento (mantenimiento proactivo).
3. Inspecciones fuera de intervalo. Si ocurrieron con un punto crítico: "el intervalo debió acortarse, no alargarse".
4. Inspecciones parciales.
5. Medidas con crecimiento atípico (reparación deficiente o digitación).
6. Medidas que bajan sin reparación.
7. Campañas de reparación (≥ 5 puntos en una parada).

---

## 5. Pantallas y navegación (rutas con `#` para que funcione en GitHub Pages)

Barra superior: logo, nombre "Integridad Estructural", Flota, Historial, Órdenes de trabajo, Registrar inspección, Datos, y un botón de tema claro/oscuro.

### 5.1 Máquina del tiempo (componente compartido)

Una franja con una marca por inspección, coloreada con el **peor estado medido ese día**, y los años debajo:

- Se arrastra o se hace clic para fijar la fecha de corte. Teclado: ← → y Fin.
- Botones de inspección anterior y siguiente, y **"Volver al presente"**.
- Con corte en el pasado, la franja se resalta con borde de acento y el texto "Viendo la plataforma como estaba el {fecha}". Las marcas futuras se ven tenues.
- Aparece en Flota, Equipo, Zona y Punto.

### 5.2 Flota (`#/`)

- Título "Traílla 631G" y un resumen en una línea.
- Fila de indicadores: puntos en Crítico, en Alerta, horas con punto crítico, MTBF estructural y OT abiertas con backlog en semanas.
- **"Qué atender primero":** tabla solo con puntos con grieta activa, ordenada por prioridad. Columnas:
  - Prioridad.
  - Punto y descripción.
  - Estado.
  - Barra L frente a Caution y Danger.
  - Llega a Danger (pesimista – central, con fecha).
  - Qué hacer.
  - Botón Crear OT, o enlace a la OT abierta.
- Debajo de la tabla: **"Reincidentes: análisis de causa raíz pendiente"**, con píldoras de cada punto (reparaciones y tiempo hasta reaparecer).
- Columna lateral:
  - **Tarjeta por equipo**: código, modelo, horómetro, peor estado y una tira con el estado de cada punto.
  - **Matriz de riesgo 5×5**: urgencia en x, consecuencia en y, con el conteo de puntos por celda.
- Hallazgos principales.

### 5.3 Equipo (`#/equipo/631-01`)

- Indicadores del equipo.
- **Modelo 3D** al lado de la lista de zonas. Al pasar el mouse sobre una zona, se resalta en el 3D.
- **Historia completa en mapa de calor:**
  - Filas = 12 puntos agrupados por zona; columnas = 25 inspecciones (fechas en vertical `aa/mm`).
  - Cada celda muestra el estado y el valor en mm (≥ 1000 como `1.1k`).
  - Reparada = "R" con borde de acento; N/I = rayado; excluida = borde punteado.
  - Encabezados de columna en ámbar si la inspección tuvo intervalo largo o fue parcial.
  - Celdas posteriores al corte, tenues. Clic en una celda → abre el punto.
  - Leyenda completa.
- Hallazgos completos.
- Botón **"Informe ejecutivo con IA"**.

### 5.4 Zona (`#/equipo/631-01/zona/{id}`)

- Selector de criticidad con su justificación.
- **Esquema real** con los puntos como círculos de color según estado (el crítico con un pulso, respetando `prefers-reduced-motion`) y etiqueta "código · L".
- Modo **"Mover puntos"** para arrastrarlos; la nueva posición se guarda.
- Tabla de puntos: estado, barra de límites, minigráfica de tendencia con línea Danger, llega a Danger y prioridad.

### 5.5 Punto (`#/punto/631-01|AP-03`) — la vista más importante

- Encabezado: código, píldora de estado, prioridad y descripción con Caution y Danger.
- Botones: "Diagnóstico con IA" y "Crear orden de trabajo" (oculto si hay corte en el pasado o no hay grieta).
- Aviso de color según estado con la acción recomendada y "urgencia × consecuencia = puntaje".
- **Gráfica de evolución** (SVG propio) con eje x conmutable entre Horas y Fecha:
  - Bandas de fondo tenues: ámbar entre Caution y Danger; roja sobre Danger.
  - Líneas punteadas Caution y Danger, con su rótulo a la derecha.
  - Puntos medidos coloreados por estado, unidos por ciclo. Los ceros (sin grieta) son círculos huecos sobre la base.
  - Reparaciones como líneas verticales punteadas con el rótulo "Reparada".
  - Excluidos como círculo punteado con una X.
  - Marcas "N/I" bajo el eje.
  - Pronóstico: línea central discontinua de acento, banda del 90 % sombreada y una **franja roja gruesa sobre la línea Danger** entre el cruce pesimista y el optimista, con el rótulo "Danger ≈ {h o fecha}".
  - Línea vertical "última inspección" o "corte".
  - **Con corte en el pasado:** lo medido después del corte en gris tenue (círculos huecos), partido en las reparaciones, rotulado "Lo que pasó después del corte". Así se compara el pronóstico con la realidad.
  - Tooltip al pasar el mouse con fecha, horas, mm, estado, inspector, comentario y marcas de calidad.
- Bloque de 4 cifras:
  - Llega a Caution en: central, rango pesimista–optimista y fecha. "Ya superado" en ámbar.
  - Llega a Danger en: igual. "Ya superado" en rojo.
  - Ritmo en mm por cada 100 h.
  - Próxima inspección: ≤ X h.
- Nota del método ("Ajuste lineal con 6 medidas… R²…").
- Columna lateral:
  - Esquema compacto con el punto seleccionado.
  - Indicadores del punto: reparaciones, reaparece tras reparar, horas sobre Danger.
  - Lista de alertas.
- **Fotos:** galería con fecha y mm, ampliable. Agregar fotos asocia la imagen a la última inspección. Botón **"Analizar foto"** con IA de visión.
- Tabla del historial (de la más reciente a la más antigua):
  - Fecha, horómetro, L, estado (o "Reparada"), inspector y comentario.
  - Marcas de calidad explicadas.
  - Casilla **Incluida/Excluida en la tendencia**.
- OT de este punto.

### 5.6 Historial (`#/historial`)

- Filtros: equipo (si hay más de uno), zona, punto, estado (incluye "Reparada"), desde, hasta, y "solo con observaciones de calidad".
- Tabla de registros.
- **Exportar Excel** con el mismo formato del Excel de entrada (hojas Léame, Historial y Puntos), así cada inspección nueva queda "junto con las anteriores".

### 5.7 Registrar inspección (`#/inspeccion/631-01`) — réplica digital del Word

- **Encabezado:**
  - Fecha.
  - Equipo.
  - Horas, con un estimado sugerido = último horómetro + días × h/día. Error si es menor que el último.
  - Inspector.
- Tabla de criterios.
- Observaciones generales.
- **Por zona:**
  - Tabla `Código | C/D | L anterior (automática) | L actual | Estado (automático) | Comentario y fotos`.
  - Casillas N/I y Reparada por punto.
  - Aviso "Reparar antes de continuar operando" si queda crítico.
  - Aviso si es menor que la anterior sin reparación.
  - El esquema con la ubicación de los puntos.
  - Observaciones de la zona.
- Botones "Guardar inspección" (agrega al historial y recalcula todo) e **"Imprimir formato"**, con estilos de impresión que lo hacen parecer el formato de papel.

### 5.8 Órdenes de trabajo (`#/ot`, `#/ot/{id}`)

- Indicadores: abiertas, backlog en h-hombre y en semanas, P1 abiertas, cerradas.
- **"Sugeridas por la plataforma":** puntos con grieta P1–P3 sin OT.
- **Tablero kanban** con las columnas Notificación, OT abierta, Planeada, Programada, Ejecutada y Cerrada.
- **Documento de la OT** (todo editable), con las 4 secciones del curso:
  1. **Encabezado:**
     - Tipo de mantenimiento: Correctivo inmediato si es crítico; "Preventivo basado en condición (restauración programada)" si está en alerta; si no, monitoreo.
     - Tipo de notificación: Inspección.
     - Prioridad, fecha de creación, fecha límite (antes de Danger) y fecha programada.
     - Descripción generada: mm, límites, estado, ritmo, pronóstico, comentario del inspector y la nota "punto reincidente" si aplica.
  2. **Objeto técnico e ISO 14224:**
     - Equipo, ubicación técnica y estado al crear.
     - Modo de falla: `STD — Deficiencia estructural`, o `BRD — Rotura` si el comentario dice fractura o pasante.
     - Mecanismo: `2.6 Fatiga` o `2.5 Rotura`.
     - Causa: `3.4 Desgaste y deterioro esperado`, o `3.3 Error de mantenimiento (reparación previa deficiente)` si es reincidente.
     - Detección: `Inspección periódica (END)`.
     - Actividad: `2 Reparación`, o `11 Combinación` si hay refuerzo.
  3. **Operaciones**, con tiempos que escalan con k = max(0,5; L/100):
     - LOTO y limpieza: 2 personas × 1,5 h.
     - END inicial: 1 h.
     - Perforaciones de alivio y arco-aire hasta metal sano: 1 + 0,6k h.
     - Precalentamiento y soldadura según WPS: 2 + 1,2k h.
     - Si es reincidente o fracturado: placa de refuerzo, 2 personas, 2 + 0,5k h.
     - Esmerilado y END final: 2 personas × 1,5 h.
     - Registro y cierre: 0,5 h.
  4. **Materiales:**
     - E7018 en kg: max(2, ⌈L/150⌉ + 1).
     - Electrodos de carbón: max(5, ⌈L/50⌉).
     - Discos, kit de END, crayones térmicos y placa de refuerzo si aplica.
  5. **Costo:**
     - Duración.
     - h-hombre.
     - Costo con una tarifa editable (45 USD/h), "base para el CMF y el CPMV".

  La OT lleva la nota "validar contra el procedimiento del fabricante".
- Botón para avanzar al siguiente estado; la historia de estados queda registrada.
- **Al cerrar:** un diálogo pide fecha, horómetro y reporte, con la casilla "Registrar la reparación en el historial". Si se marca, se agrega una medida L = 0 reparada y el punto empieza un ciclo nuevo.
- Imprimir / PDF.

### 5.9 Datos (`#/datos`)

- **Carga del Excel:**
  - Modo "Agregar al historial" (sin duplicar punto + fecha) o "Reemplazar todo".
  - Registro de cargas.
  - Exportar historial.
  - Respaldo y restauración en JSON. El respaldo **excluye la clave de API**.
  - "Restaurar datos originales".
- **Revisión de calidad:** conteo por tipo de marca, intervalos largos y tabla de registros con observaciones (fila del Excel, fecha, punto, mm, explicación y casilla incluir/excluir).
- **Criticidad de zonas**, con su justificación y el esquema asignado a cada zona.
- **Parámetros:**
  - Crecimiento acelerado: 15 mm por cada 100 h.
  - Cerca de Caution: 80 %.
  - Ventana de alerta: 600 h.
  - Intervalo objetivo: 700 h.
  - Capacidad: 96 h-hombre por semana.
  - Tarifa: 45 USD/h.
- **Límites por punto**, editables.
- **IA:** clave (campo de contraseña), modelo (`claude-opus-5-5` por defecto, `claude-sonnet-5-5`, `claude-haiku-4-5-20251001`) y "Probar conexión".
- **Biblioteca de imágenes:** subir esquemas y fotos con el mismo nombre de la columna Imagen del Excel, y ver miniaturas.

---

## 6. Inteligencia artificial dentro de la plataforma

Llamada directa desde el navegador:

```
POST https://api.anthropic.com/v1/messages
headers: x-api-key, anthropic-version: 2023-06-01,
         anthropic-dangerous-direct-browser-access: true, content-type: application/json
body: { model, max_tokens: 2000, system, messages: [{ role: 'user', content: [ (imagen base64 opcional), { type: 'text', text } ] }] }
```

Verifica los nombres de modelo y los encabezados vigentes en https://docs.claude.com antes de programarlo.

**Mensaje de sistema** (en español): eres un ingeniero de confiabilidad experto en integridad estructural de equipo minero; conoces el criterio Normal / Alerta / Crítico / N/I del formato y el vocabulario del curso; los datos son de campo y pueden tener errores (señálalos); responde en Markdown breve con cifras, fechas, horas y la decisión; no inventes datos.

**Tres usos:**

1. **Informe ejecutivo del equipo.** Contexto: indicadores, todos los puntos con estado y acción, hallazgos, inspecciones con sus marcas, OT, y el historial detallado por punto. Pide:
   - El estado en 3 líneas.
   - Las decisiones de esta semana (¿puede operar el equipo?).
   - Riesgos y patrones con hipótesis de causa raíz.
   - Fallas de gestión observadas y cómo evitarlas.
   - Calidad de datos.
   - Tres recomendaciones proactivas.
2. **Diagnóstico de un punto:**
   - ¿Qué tan confiable es la tendencia?
   - ¿Cuándo intervenir y con qué tipo de mantenimiento?
   - ¿Qué causa raíz es probable?
   - ¿Cómo evitar que reincida?
   - Una línea final con la recomendación.
3. **Análisis de foto** (visión). La imagen se reduce a máx. 1568 px y se envía en JPEG base64. Pide describir la indicación, si parece pasante, si es coherente con la medida y qué verificar en campo, y advertir si la foto no permite concluir.

Se muestra en un panel lateral con Markdown renderizado, con "Copiar resultado", "Regenerar" e "Imprimir", y el texto "verifique cifras antes de actuar". **Sin clave**, el mismo panel ofrece **"Copiar para pegar en Claude"** con el mensaje completo. También hay un desplegable "Ver la información que se envía", que sirve como transparencia para la exposición.

---

## 7. Modelo 3D simplificado de la traílla 631G (Three.js)

Ejes: x hacia adelante (tractor delante), y hacia arriba, z hacia la derecha del operador. Unidades aproximadas en metros. Geometría con primitivas:

- **Tractor delantero:**
  - Ruedas en x = 5,6, z = ±1,78, r = 1,0, ancho 0,8.
  - Bastidor; capó amarillo apagado (≈ #c8b06a) de 2,2 × 1,25 × 1,65 centrado en (6,2; 1,85; 0).
  - Cabina de vidrio translúcido en (4,7; 3,05; 0) con techo.
  - King-pin vertical en x = 3,7.
- **Gooseneck:** vigas cilíndricas (3,7; 1,9) → (3,2; 3,3) → (1,7; 3,35). Brazos de tiro a cada lado: (1,7; 3,3; ±0,35) → (0; 2,75; ±1,95) → (−1,7; 1,55; ±1,95).
- **Caja (zona BW):**
  - Paredes laterales de 6,2 × 2,4 × 0,12 en x de −6,0 a 0,2, z = ±1,75.
  - Piso, pared trasera y largueros superiores e inferiores.
  - **Tubo transversal superior** en x = −1,4, y = 2,95 (BW-02).
- **Apron (zona AP), compuerta curva que cierra el frente:**
  - Cuarto de cilindro abierto, radio 1,5, largo 3,5 (`thetaStart 0`, `thetaLength π/2`), con `rotation.x = π/2` y centro en (0,1; 2,0; 0). Va del fondo (y = 0,5) al frente (x = 1,6).
  - Placa vertical superior en x = 1,6 (y de 2,0 a 2,9).
  - Laterales: cuarto de círculo (`thetaStart −π/2`) más un rectángulo, en z = ±1,76.
  - Brazos al pivote.
  - **Oreja de levante central** en (1,75; 2,85; 0) con su cilindro de levante hacia el gooseneck.
  - Material de doble cara.
- **Eyector (zona EY):** placa de empuje en x = −4,4; brazos del bastidor hacia (−6,5; 1,15; ±0,9); cilindro central.
- **Tractor trasero:** ruedas en x = −5,2, z = ±1,98; bloque de motor y bloque de empuje.

**Posición 3D de cada punto:**

```
BW-01 (-0.15, 2.85, -1.78)  BW-02 (-1.4, 2.95, 0)   BW-03 (-3.0, 1.8, 1.62)  BW-04 (-3.0, 0.75, -1.82)
EY-01 (-4.35, 1.95, 0.45)   EY-02 (-4.55, 1.45, -0.85)  EY-03 (-5.45, 1.25, 0.9)  EY-04 (-4.6, 1.65, 0)
AP-01 (0.2, 2.45, -1.9)     AP-02 (0.85, 1.55, -1.82)   AP-03 (1.92, 2.85, 0)    AP-04 (1.2, 0.92, 0.35)
```

Si aparece un punto nuevo sin coordenada, repartirlo sobre su zona a partir de la posición 2D.

**Interacción:**

- Esferas de radio 0,17 con el color del estado. Halo pulsante en Alerta y Crítico (sin animación si `prefers-reduced-motion`).
- Etiquetas HTML proyectadas con el código.
- OrbitControls con amortiguación y límites de distancia y de ángulo polar.
- Raycast: al pasar el mouse, tooltip (código, estado, descripción, L, C y D); al hacer clic (sin arrastre), abre el punto.
- Casilla "Caja transparente" para ver el eyector.
- Al pasar sobre una zona en la lista, se ilumina en el 3D.
- Liberar geometrías y materiales al desmontar.
- Rótulo: "Representación simplificada".

**Revisa el modelo con capturas desde 3 ángulos** hasta que la caja, el apron y el eyector sean reconocibles y los puntos queden sobre la pieza correcta.

---

## 8. Diseño visual

Es una herramienta para ingenieros de mantenimiento, con rotulación industrial y precisión de plano técnico.

**No debe parecer una plantilla genérica:**

- Nada de fondo crema con acento terracota.
- Nada de negro con acento verde neón.
- Nada de tarjetas idénticas con sombra gris.
- Nada de etiquetas en MAYÚSCULAS espaciadas.
- Nada de flechas "→" en los botones.

**Tipografía** (empaquetada con `@fontsource`, para que funcione sin internet):

- **Barlow** para la interfaz (400/500/600).
- **Barlow Condensed** para títulos y cifras grandes (600/700).
- Cifras tabulares en tablas y ejes.

**Colores** (variables CSS en `:root`, con modo oscuro por `prefers-color-scheme` y por `data-theme`):

| Token | Claro | Oscuro |
|---|---|---|
| plano (fondo) | #e5e9ec | #0e1317 |
| superficie | #f8fafa | #151c21 |
| superficie 2 / 3 | #eef2f3 / #e3e8eb | #1b242a / #232e35 |
| tinta / tinta 2 / apagado | #17232c / #4b5a66 / #7a8892 | #ecf1f4 / #a9b6bf / #7e8b95 |
| línea | #d2d9de | #29343c |
| acento (azul de plano) | #1d5c8c | #5fa1d6 |
| Normal / Alerta / Crítico | #0ca30c / #fab219 / #d03b3b | iguales |
| Sin grieta / N/I | #8e9ba5 / #b7c0c6 | #6d7a84 / #3b464e |

**Reglas de color y forma:**

- Los colores de estado se usan **solo** para estado y siempre van con **forma e icono**: círculo lleno = Normal, triángulo = Alerta, rombo con "!" = Crítico, círculo hueco = Sin grieta, círculo punteado = N/I.
- Texto sobre fondos de estado con buen contraste.
- Prioridad como insignia: P1 rojo sólido, P2 borde rojo, P3 borde ámbar, P4 gris.
- Los esquemas siempre sobre fondo blanco; en modo oscuro se invierten con `filter: invert(.88) hue-rotate(180deg)`.

**Composición y calidad:**

- Paneles con borde fino de 1 px y radio de 10 px, sin sombras pesadas.
- Fila de indicadores como una sola franja dividida.
- Contenido alineado a la izquierda, con ancho máximo de 1360 px.
- Se adapta a celular (una columna; tablas con desplazamiento horizontal propio) **sin desplazamiento horizontal de la página**.
- Foco visible con el teclado.
- Estilos de impresión para la OT y el formato de inspección.
- El elemento memorable es la **máquina del tiempo** junto con la **gráfica con pronóstico**; todo lo demás, sobrio.

**Textos** en español, en primera persona del usuario: "Registrar inspección", "Crear OT", "Qué atender primero", "Volver al presente". Los mensajes de error dicen qué pasó y cómo arreglarlo.

---

## 9. Arquitectura técnica

- **Vite + React 18 + TypeScript (strict).**
- Dependencias:
  - `xlsx` (SheetJS) para leer y escribir Excel.
  - `three` para el 3D.
  - `zustand` para el estado.
  - `idb-keyval` para persistir en IndexedDB: la base completa en una clave y cada imagen como Blob en `img:{nombre}`.
  - `@fontsource/barlow` y `@fontsource/barlow-condensed`.
- Desarrollo: `tsx` (pruebas del motor) y `playwright` (capturas).
- `vite.config.ts` con `base: './'`, para que funcione en GitHub Pages bajo `/Taller-en-enfasis-/`.
- Las gráficas se dibujan en **SVG propio**, sin librería de gráficas.

**Estructura sugerida:**

```
src/
  types.ts                tipos (Unit, Zone, Point, Inspection, InspectionEvent, WorkOrder, Settings, DB)
  store.ts                zustand + persistencia + imágenes (useImage, saveImage)
  router.ts               rutas por hash
  lib/catalog.ts          coordenadas 2D/3D, criticidades, imágenes incluidas
  lib/importer.ts         parseWorkbook, mergeImport, exportWorkbook
  lib/quality.ts          runQuality (marcas y exclusiones)
  lib/analysis.ts         estado, ciclos, ajuste, pronóstico, riesgo, alertas, indicadores, hallazgos
  lib/ot.ts               createWorkOrder, flujo, opciones ISO 14224
  lib/ai.ts               contexto, prompts, askClaude, blobToBase64
  components/             Timeline, HeatHistory, GrowthChart, Schematic, Scraper3D, Ranking, RiskMatrix, AIPanel, ui
  views/                  Fleet, Unit, Zone, Point, History, WorkOrders, InspectionForm, Data
tools/probar-motor.ts     pruebas de aceptación de la sección 3
```

**Modelo de datos:**

- Un `Point` es la combinación equipo + código, con sus límites.
- Un `InspectionEvent` es el encabezado de una visita (fecha, horas, inspector, observaciones y marcas).
- Cada `Inspection` es una medida de un punto en una visita. Lleva `length: number|null`, `repaired`, `comment`, `photos[]`, `excluded`, `override?`, `flags[]` y `row` (la fila del Excel).
- `analyze(db, asOf)` devuelve el estado de toda la flota y se memoiza por (db, corte).

---

## 10. Fases de trabajo (verificar cada una antes de pasar a la siguiente)

1. **Plan.** Lee este documento e inspecciona el Excel y el Word con Python (pandas, python-docx). Confirma que coinciden con la sección 2 y muestra el plan.
2. **Datos y motor.**
   - Extrae las imágenes del docx y verifica las coordenadas con una superposición.
   - Escribe el importador, la calidad y el análisis, y `tools/probar-motor.ts`.
   - **Debe reproducir la sección 3**, incluido el corte 2024-04-30.
3. **Esqueleto de la interfaz:** tokens de diseño, barra, rutas, persistencia, carga automática del Excel incluido y la máquina del tiempo.
4. **Flota y Equipo:** indicadores, ranking, reincidentes, matriz, mapa de calor e historia, hallazgos.
5. **Punto:** gráfica con pronóstico y lo que pasó después, bloque de cifras, fotos, historial con incluir/excluir.
6. **Zona y esquemas:** marcadores bien anclados y el modo de mover puntos.
7. **Órdenes de trabajo:** creación, documento editable, kanban, cierre que registra la reparación, backlog.
8. **Formulario de inspección** e impresión; **Historial** con filtros y exportación; **Datos**.
9. **Modelo 3D.**
10. **IA:** panel, 3 usos, sin clave → copiar.
11. **Verificación con Playwright** (Chromium headless: `npx playwright install --with-deps chromium`):
    - Capturas de página completa de cada ruta en claro y oscuro a 1400 px, y en celular a 390 px.
    - **Míralas tú mismo** y corrige superposiciones, cortes y desalineaciones.
    - Prueba el flujo completo: crear OT → avanzar → cerrar con reparación → el punto queda en "Sin grieta" con una reparación más.
    - Prueba la máquina del tiempo en 2024-04-30 sobre AP-03.
    - Registra una inspección de prueba y luego usa "Restaurar datos originales".
    - Cero errores en consola.
12. **Entrega:** `README.md`, despliegue en GitHub Pages y commit/push (sección 11).

Haz commits pequeños y descriptivos al final de cada fase.

---

## 11. Despliegue en GitHub Pages

Crea `.github/workflows/deploy.yml`:

```yaml
name: Desplegar en GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Pasos:**

1. `.gitignore` con `node_modules`, `dist` y `.env*`.
2. Commit y push a `main`.
3. Activar Pages con Actions: `gh api -X POST repos/jdvc2409/Taller-en-enfasis-/pages -f build_type=workflow`, o en Settings → Pages → Source: GitHub Actions.
4. Esperar el workflow (`gh run watch`) y abrir `https://jdvc2409.github.io/Taller-en-enfasis-/`.

Revisa que carguen el Excel, las imágenes y las fuentes; con `base: './'` las rutas deben ser relativas.

**README:** qué es, el link, cómo usarlo, cómo correrlo localmente (`npm install && npm run dev`) y cómo se calcula cada cosa (estado, pronóstico, prioridad, hallazgos). Incluye una sección **"Qué encontró la plataforma en los datos"** con los hallazgos de la sección 3 y una explicación del uso de IA (en el desarrollo y dentro de la plataforma).

---

## 12. Reglas

- **No inventes datos**: ni equipos simulados ni fotos falsas. Los tiempos y materiales de la OT son plantillas de referencia y se rotulan como tales.
- **No pongas la clave de API** en el código, en el `.env` del repositorio, en los commits ni en el respaldo JSON.
- N/I nunca cuenta como 0. Una reparación (L = 0 con comentario de reparación) inicia un ciclo nuevo.
- Todo lo editable (criticidad, límites, umbrales, posiciones, inclusión de medidas) se guarda en IndexedDB, y cualquier lectura o escritura de almacenamiento va en try/catch.
- Cada decisión que muestre la plataforma debe explicar de dónde sale: método del pronóstico, urgencia × consecuencia y criterio del formato.
- Antes de decir que algo está listo, verifícalo con capturas y con el script de aceptación.
