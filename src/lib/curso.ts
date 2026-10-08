// Material del curso Gestión del Mantenimiento (Universidad de La Sabana) que el chatbot usa para responder teoría.
// Extraído con pdftotext de los PDF de la carpeta curso/ y ordenado por semana y tema; se quitaron portadas,
// numeración de diapositivas y texto repetido entre diapositivas. Las definiciones, fórmulas y listas se conservan.
//   Semana 1        ← curso/Semana_1_Introduccion.pdf
//   Semana 2        ← curso/Semana_2_Conceptos_clave_evolucion_y_tipos_de_mantenimiento.pdf
//   Semanas 3 y 4   ← curso/Semanas_3_y_4_Departamento_programacion_y_planeacion.pdf
//   Semana 5        ← curso/Semana_5_Indicadores_y_ordenes_de_trabajo.pdf

export const CURSO = `# GESTIÓN DEL MANTENIMIENTO — material del curso

## SEMANA 1 — Introducción a la clase

### ¿Por qué es importante el mantenimiento?
- Máximo desempeño. Reducir costos. Disminuir tiempos de parada.
- Preguntas guía: ¿Cómo obtener el mejor desempeño de los equipos? Cuando fallen, ¿cómo habilitarlos prontamente? ¿Cuáles son los costos asociados a una falla?

### El equipo como sistema (ejemplo: motoniveladora)
Conjunto de sistemas interdependientes. La falla de uno de ellos puede afectar la operación, la seguridad y la disponibilidad del equipo.
Sistemas principales: potencia, hidráulico, eléctrico, frenos, enfriamiento, transmisión, implementos. Una falla en un sistema puede afectar el funcionamiento de otros sistemas.

### Evento de seguridad (caso)
Durante una intervención de mantenimiento, la fractura súbita de un cilindro provocó la caída incontrolada de la cuchilla a pocos centímetros de un técnico. Sin lesiones personales, pero con alto potencial de accidente fatal. Evidencias: vástago fracturado, ojo del vástago, taponamiento del orificio de lubricación, superficie de fractura.
- ¿Cómo pudo evitarse? Ningún tipo de mantenimiento, por sí solo, evita todas las fallas. La integración de todas las estrategias reduce el riesgo y mejora la confiabilidad del equipo.
- ¿Quién debió evitarlo? Una gestión de mantenimiento efectiva requiere que todas las áreas trabajen de forma coordinada para prevenir fallas, proteger a las personas y garantizar la confiabilidad de los activos.

Docente: Carlos Arturo Flórez Taibel (Ingeniería Mecánica y Maestría en Ingeniería Mecánica, Universidad del Norte).

## SEMANA 2 — Conceptos clave, evolución y tipos de mantenimiento

### Conceptos clave
- **Activo:** recurso o propiedad que tiene valor y es utilizado en las operaciones de una organización. Puede incluir maquinaria, edificios, vehículos y sistemas informáticos que contribuyen a la producción o funcionamiento de la empresa.
- **Equipo:** herramientas, máquinas o dispositivos diseñados para realizar tareas específicas en procesos industriales o de ingeniería. Puede estar compuesto por varios componentes y se utiliza para llevar a cabo funciones operativas esenciales.
- **Componente:** elemento físico identificable de un equipo, con una función definida, para el cual se pueden recopilar datos de falla, mantenimiento y desempeño, y cuya falla contribuye a la falla del equipo o sistema.
- Ejemplo (pala eléctrica P&H 2800 XPC): activo = maquinaria para remover material estéril; equipo = palas eléctricas XPC E28; componente = transmisión de traslación.
- **Falla:** incapacidad de un equipo o sistema para cumplir con su función prevista debido a un defecto, desgaste o daño. Resulta en la interrupción del funcionamiento normal y requiere reparación o reemplazo para restaurar el rendimiento adecuado.
- **Defecto:** imperfección o anomalía en un componente, material o sistema que puede afectar su desempeño o calidad. Puede ser causado por errores en el diseño, fabricación o materiales y puede llevar a problemas operativos si no se corrige a tiempo.
- **Criticidad:** grado de importancia y el impacto que tiene un componente, equipo o sistema en el funcionamiento general de una operación. Evalúa cómo la falla de un elemento crítico puede afectar la seguridad, la producción o el rendimiento de un proceso. Su identificación ayuda a priorizar esfuerzos de mantenimiento y recursos para minimizar riesgos y asegurar la continuidad operativa.
- Ejemplo (pala P&H 2800 XPC): defecto = uso prolongado de un pasador por encima de su vida útil, que lo desgasta; falla = fractura del pasador del brazo; criticidad = se priorizaron motor y transmisiones y no se hizo mantenimiento predictivo al pasador durante la vida de la pala.
- **Confiabilidad:** capacidad de un activo, equipo o componente para desempeñar la función requerida, bajo condiciones establecidas de operación y mantenimiento, durante un intervalo de tiempo determinado.
- **Disponibilidad:** proporción de tiempo que un sistema, equipo o servicio permanece operativo y accesible para realizar su función cuando se le requiere.
- **Mantenibilidad:** capacidad de un activo, equipo o componente para ser mantenido o restaurado a una condición en la que pueda cumplir su función requerida, dentro de un tiempo dado, utilizando procedimientos y recursos establecidos.
- Resumen: confiabilidad = que no falle; mantenibilidad = que se repare rápido; disponibilidad = que esté funcionando cuando lo necesito.

### Evolución del mantenimiento (1940–2010)
- **Primera generación:** reparar cuando se rompe / cuando falla.
- **Segunda generación:** mayor disponibilidad de planta, mayor vida de los equipos, menor costo. Reparaciones programadas, sistemas de planeamiento y control de trabajo, computadoras grandes y lentas.
- **Tercera generación** (expectativas crecientes): mayor disponibilidad y confiabilidad de la planta, mayor seguridad, mejor calidad de producto, ningún daño al medio ambiente, mayor vida de los equipos, mayor costo-eficacia. Técnicas: monitoreo de condición, diseño direccionado a la confiabilidad y facilidad para el mantenimiento, estudio de riesgos, computadoras pequeñas y rápidas, análisis de modos de falla y sus efectos, sistemas expertos, trabajo multifacético y en grupos.

### Mantenimiento: definición y clasificación
Conjunto de actividades y procesos diseñados para asegurar que los equipos, máquinas e instalaciones operen de manera segura y eficiente durante su vida útil. Incluye prevención de fallas, reparación de averías y optimización del rendimiento de los sistemas mecánicos.
Se clasifica en: correctivo, preventivo, predictivo, proactivo y centrado en la confiabilidad (RCM).

### Mantenimiento correctivo
- Concepto: se lleva a cabo cuando un equipo o sistema ya ha fallado o está a punto de fallar; se enfoca en corregir problemas ya existentes.
- Objeto: corregir fallos existentes, minimizar tiempos de inactividad y restaurar la funcionalidad.
- Tipos: (1) **Correctivo inmediato:** se realiza tan pronto como se detecta una falla para minimizar el tiempo de inactividad. (2) **Correctivo diferido:** se planifica para un momento posterior cuando la falla no afecta gravemente la operación o cuando no hay recursos disponibles de inmediato.
- Proceso: 1) Detección de la falla (identificación del problema); 2) Diagnóstico (evaluación de la causa); 3) Intervención (reparación o reemplazo de piezas defectuosas); 4) Pruebas (verificación de que vuelve a funcionar correctamente).
- Aplicación: sectores con equipos de baja criticidad o donde el mantenimiento preventivo no es viable.

### Mantenimiento preventivo
- Concepto: intervenciones programadas para evitar fallos y mantener la eficiencia. Se basa en inspecciones, ajustes y reparaciones regulares para mantener los equipos en condiciones óptimas.
- Objeto: reducir fallos inesperados, prolongar la vida útil de los equipos y mejorar la seguridad.
- Tipos: (1) **Basado en el tiempo:** en intervalos regulares, independientemente del estado del equipo. (2) **Basado en el uso:** después de un determinado número de horas de operación. (3) **Basado en el estado:** según la condición actual del equipo, usando datos para determinar cuándo realizar el mantenimiento.
- Proceso: 1) Planificación (determinación de intervalos y procedimientos); 2) Inspección y monitoreo (verificación del estado); 3) Intervención (reemplazo de piezas desgastadas, ajustes, lubricación); 4) Documentación (registro de actividades y resultados).
- Aplicación: crítico en manufactura, aviación, energía y salud.

### Mantenimiento predictivo
- Concepto: utiliza monitoreo continuo y análisis de datos para predecir fallos y realizar intervenciones solo cuando sea necesario, evitando problemas antes de que ocurran.
- Objetivo: usar datos y análisis para prever fallos antes de que sucedan, permitiendo intervenciones planificadas en función del estado real del equipo.
- Tipos: (1) **Basado en condiciones (CBM):** monitorea vibraciones, temperatura, etc. Técnicas: análisis de vibraciones, termografía, análisis de aceite. (2) **Basado en modelos:** modelos matemáticos/físicos, datos históricos y simulaciones. (3) **Inteligencia artificial y machine learning:** algoritmos que detectan patrones en grandes volúmenes de datos. (4) **Inspección visual y pruebas no destructivas:** ultrasonido, rayos X, entre otros, para evaluar el estado interno sin desmontar. (5) **Híbrido:** combina múltiples técnicas para mayor precisión.
- Proceso: 1) Monitoreo continuo (sensores y herramientas para recopilar datos del rendimiento); 2) Análisis de datos (identificar patrones y predecir fallos potenciales); 3) Intervención basada en condición (mantenimiento solo cuando los datos indican que es necesario); 4) Documentación y ajustes de los procedimientos según los hallazgos.

### Mantenimiento proactivo
- Concepto: estrategia orientada a eliminar o controlar las causas raíz que generan fallas y degradación. No se limita a "detectar" o "reparar": modifica condiciones de operación, diseño y prácticas para evitar que el daño vuelva a aparecer.
- Objeto: prevenir la recurrencia de fallas; reducir la degradación (desgaste, corrosión, fatiga, contaminación, desalineación, vibración); aumentar confiabilidad y vida útil; disminuir costos totales (retrabajo, paradas, repuestos) y mejorar la seguridad.
- Tipos: (1) **Eliminación de causa raíz (RCFA / RCA):** acciones correctivas permanentes basadas en análisis causal. (2) **Control de condiciones base ("defect elimination"):** limpieza, lubricación correcta, sellado, alineación, torque, balanceo, control de contaminación. (3) **Mejora de diseño / ingeniería:** rediseños, cambios de material, refuerzos, protecciones, cambios de tolerancias o geometría. (4) **Optimización operativa:** ajustes de parámetros de operación (carga, temperatura, presión, velocidades), procedimientos y hábitos de uso.
- Proceso: 1) Identificación y priorización (equipos críticos, fallas repetitivas, pérdidas por paradas, costos o seguridad); 2) Control de condiciones base; 3) Mejora de diseño / ingeniería; 4) Documentación.
- Aplicación: clave en activos de alta criticidad y alta recurrencia de fallas: minería y equipo pesado, manufactura continua, energía, transporte, procesos químicos, salud. Se integra muy bien con RCM, TPM y mantenimiento predictivo (usa sus hallazgos para eliminar causas, no solo para detectar).

### Mantenimiento centrado en confiabilidad (RCM)
- Concepto: se enfoca en garantizar la confiabilidad de equipos críticos, identificando y aplicando las prácticas de mantenimiento más efectivas para asegurar un funcionamiento seguro y eficiente durante toda su vida útil.
- Objetivos: 1) que los equipos funcionen de manera segura, minimizando el riesgo de fallos catastróficos; 2) maximizar la disponibilidad operativa reduciendo tiempos de inactividad; 3) equilibrar los costos de mantenimiento con los beneficios en fiabilidad y disponibilidad; 4) asegurar que los equipos cumplan los requisitos operativos de la organización.
- Proceso: 1) Análisis funcional (funciones principales y secundarias); 2) Identificación de modos de falla (todas las formas en que puede fallar en sus funciones); 3) Análisis de consecuencias de falla (impacto en operación, seguridad y medio ambiente); 4) Selección de tareas de mantenimiento (preventivo, predictivo o correctivo para cada modo de falla); 5) Implementación y seguimiento (ajustar las estrategias según sea necesario).

### Aplicación: mantenimiento de un motor diésel
Sistemas del motor: admisión y escape, lubricación, enfriamiento, inyección.
Plan de mantenimiento preventivo: inspección cada 50 h o cada semana; 125 h o 2 semanas; 250 h o cada mes; 1.000 h o 6 meses; 2.000 h o cada año; 3.000 h o 2 años; 6.000 h. Las unidades de tiempo se basan en las recomendaciones del fabricante, las condiciones de operación, las horas de uso, los kilómetros recorridos, el tiempo calendario, el historial de mantenimiento y fallas, las normativas y los costos; se combinan para optimizar la disponibilidad y la vida útil, con un balance entre efectividad y recursos disponibles.
Ejemplos de tareas por intervalo: comprobar la rejilla de admisión de aire y limpiar el filtro primario y el sello; cambiar filtro y aceite del motor, revisar partículas en el filtro, limpiar el respiradero del cárter, lubricar la polea del ventilador, apretar abrazaderas, cambiar el filtro de combustible, revisar desgaste o fugas en bandas, polea del ventilador, radiador y mangueras; inspeccionar dispositivos de seguridad, lubricar el varillaje del acelerador, revisar indicadores del tablero; cambiar el filtro de aire primario, ajustar válvulas según el manual, comprobar inyectores, RPM en vacío, presión del turbo, montaje del motor y sistemas de arranque y carga; tomar muestra de refrigerante para análisis y agregar prolongador al refrigerante de larga duración.
Plan de mantenimiento predictivo (50 h, 125 h, 250 h): análisis de temperatura de operación con sensores y termografía infrarroja; monitoreo de vibraciones para detectar desalineaciones; análisis de aceite en laboratorio (estado del lubricante, contaminantes, desgaste interno); monitoreo de niveles de ruido; inspección de ultrasonido para detectar grietas en culatas o bloques; análisis de vibraciones en rodamientos y engranajes; termografía para puntos calientes.

Referencias de la semana: ISO 14224:2016 (recolección e intercambio de datos de confiabilidad y mantenimiento de equipos); ISO 55000:2014 y ISO 55001:2014 (gestión de activos); Moubray, J. (1997), Mantenimiento Centrado en Confiabilidad (RCM II).

## SEMANAS 3 Y 4 — Departamento de mantenimiento. Programación y planeación

### Funciones del departamento de mantenimiento
Dos funciones: intervenir y evaluar.
- **Ejecución:** estrategias y métodos para asegurar que los equipos operen de manera óptima y segura durante su vida útil. Actividades: reparaciones y reemplazo de componentes, mantenimiento preventivo, documentación de intervenciones.
- **Monitoreo de condición (grupo especial):** evaluar el estado de los equipos para detectar condiciones anormales y anticipar posibles fallas. Actividades: monitoreo de vibraciones, análisis termográfico, análisis de aceite.
- **Programadores:** organizan y coordinan las tareas para ejecutar el mantenimiento en el momento adecuado. Actividades: gestión de solicitudes de repuestos, agenda de mantenimiento, coordinación con producción y operadores. La ejecución necesita coordinación para ocurrir en el momento adecuado.
- **Planeadores:** definen estrategias y recursos para optimizar el mantenimiento a largo plazo. Actividades clave: registro y gestión del consumo de repuestos para reposición en inventario; colaboración con Compras y gestión de proveedores; sustitución de componentes por cumplimiento de vida útil; planeación de tareas estratégicas; seguimiento al presupuesto.
- **Analistas de confiabilidad:** evalúan y mejoran la confiabilidad de equipos y sistemas para minimizar fallas y optimizar la disponibilidad. Actividades: analizar datos históricos para identificar patrones de fallos; implementar estrategias de mantenimiento predictivo; realizar estudios FMEA para prevenir fallos.
- **Especialistas de mantenimiento:** análisis de falla, fluidos, datos, sistemas.
- Integración: Ejecución interviene (reparar, prevenir, documentar); Grupo especial inspecciona (vibraciones, termografía, aceite); Programadores coordinan (repuestos, agenda, producción); Especialistas apoyan (falla, fluidos, datos, sistemas); Confiabilidad analiza (datos, predictivo, FMEA); Planeadores preparan (recursos, proveedores, presupuesto).

### Cómo se conecta el departamento
PLANEACIÓN (¿Qué se debe hacer?) → PROGRAMACIÓN (¿Cuándo y con qué recursos?) → EJECUCIÓN (realizar el trabajo) → ANÁLISIS (¿Qué aprendimos de los resultados?). Pregunta de clase: ¿qué pasa si una de estas etapas falla?

### Programación del mantenimiento
¿Qué cuesta más? Programar mantenimiento (invertir tiempo y recursos hoy para evitar problemas mañana) vs. que la máquina se detenga inesperadamente (costos altos, paradas de producción, riesgos de seguridad y clientes insatisfechos). La programación busca intervenir el equipo antes de que la producción se detenga y asegurar su confiabilidad.
Esquema básico de la estructura RCM: programación, ejecución y control. Ciclo de trabajo para el mantenimiento adaptado de Crespo, The Maintenance Management Framework (2007). [diagrama sin texto]

### Planeación vs. programación
| PLANEACIÓN (¿Qué se hará?) | PROGRAMACIÓN (¿Cuándo se hará?) |
|---|---|
| Define el alcance del mantenimiento y las actividades requeridas. | Organiza la ejecución de las actividades en una fecha y hora específicas. |
| Estima recursos: personal, herramientas, materiales y tiempo. | Asigna y distribuye esos recursos según su disponibilidad. |
| Prioriza las tareas según la criticidad del equipo. | Coordina el trabajo para evitar conflictos con la operación y optimizar el uso de los recursos. |
| Resultado: plan de trabajo. | Resultado: cronograma de mantenimiento. |
Primero se planea el trabajo; después se programa su ejecución. Pregunta de clase: si ya hay repuestos y procedimiento pero el equipo sigue operando porque Producción no puede detenerlo, ¿es problema de planeación o de programación?

### ¿Qué implica programar el mantenimiento?
Coordinar el momento, los recursos y las condiciones necesarias para ejecutar un trabajo planificado de manera segura, eficiente y sin afectar la operación. Del trabajo planificado se pregunta "¿todo está disponible?":
- Personal: ¿hay técnicos disponibles y con las competencias requeridas?
- Herramientas: ¿se cuenta con los equipos y herramientas necesarias?
- Repuestos: ¿los materiales ya fueron recibidos y verificados?
- Producción: ¿el equipo puede salir de operación sin afectar el proceso?
- Tiempo: ¿existe una ventana de mantenimiento aprobada?
Si todo está, se programa la orden de trabajo (OT). La programación transforma un plan de mantenimiento en una actividad ejecutable, garantizando que los recursos adecuados estén disponibles en el momento oportuno.

### Principios de la programación
1. **Planificar antes de ejecutar:** una programación efectiva comienza con un plan de trabajo bien definido. Antes de asignar una fecha hay que conocer el alcance, el personal requerido, las competencias y el tiempo estimado. Aspectos clave: definir el alcance, estimar horas de especialidad, asignar el nivel de competencia requerido, establecer prioridades antes de programar.
2. **Programar significa administrar el tiempo:** aprovechar al máximo la disponibilidad de personas, equipos y recursos, respetando prioridades y dejando capacidad para emergencias. Buenas prácticas: cronograma semanal, pronosticar horas disponibles, balancear trabajos preventivos y correctivos, reservar capacidad para emergencias.
3. **¿Cómo evaluar una buena programación?** Con indicadores de su impacto: cumplimiento del cronograma, reducción de tiempos muertos, mayor tiempo de trabajo efectivo, menor cantidad de reprogramación, mayor disponibilidad de equipos. Resultado: mayor cumplimiento, menos retrasos, mayor disponibilidad, mayor productividad.

### Proceso de la programación (8 pasos)
1) Realizar pronóstico de horas de trabajo. 2) Ordenar y clasificar órdenes de trabajo. 3) Comprobar disponibilidad y competencias de los recursos. 4) Asignar órdenes de trabajo. 5) Desarrollar programa semanal indicando fecha y hora prevista de ejecución. 6) Conciliar el programa con los supervisores de producción y mantenimiento. 7) Ejecutar y completar órdenes de trabajo. 8) Registrar información relevante.

### Actividades de programación y su frecuencia
- Seleccionar activos a intervenir en la ventana de programación (próximos 7 o 14 días) y programar su detención según las horas del límite inferior del intervalo o según su condición — semanal.
- Hacer solicitud de materiales, componentes, repuestos y consumibles — diario.
- Preparar y alistar la llegada de recursos (partes, materiales, equipos de soporte, proveedores) — diario.
- Definir con planeación y análisis las tareas del programa preliminar — semanal.
- Comunicar la programación definitiva a los interesados (externos e internos) — semanal.
- Balancear recursos (mano de obra, áreas de trabajo y equipos de soporte) — semanal.

### Planeación del mantenimiento
¿Por qué planear antes de intervenir? Caso: se programa el cambio del motor de una bomba y el técnico descubre que no existe procedimiento, el repuesto es incorrecto, falta una llave especial y no hay permiso para intervenir. El problema real fue de planeación.
- Rol del planeador: preparar el trabajo antes de su ejecución. Definir el alcance del trabajo; estimar personal y competencias; determinar herramientas y materiales; calcular el tiempo de ejecución; preparar la orden de trabajo.
- Pilares de una buena planeación: **enfoque estratégico** (preparar las actividades antes de ejecutarlas), **información confiable**, **experiencia técnica** (definir recursos, tiempos y materiales con criterio técnico) y **mejora continua** (ajustar procedimientos a partir de los resultados).
- Caso de clase: hay OT pero al llegar el técnico no hay repuesto disponible → ¿qué pilar falla? (opciones: enfoque estratégico, información confiable, experiencia técnica, mejora continua).
- Actividad: motoniveladora con sobrecalentamiento severo e incendio; la polea tensora de la correa de distribución se frenó, generó fricción excesiva y degradó un tanque plástico cercano, sin alertas previas y con detención no programada. Objetivo: investigar técnicas predictivas aplicables, cómo se implementarían, qué variables monitorear, qué falla anticiparían y una conclusión técnica.

## SEMANA 5 — Indicadores de mantenimiento y órdenes de trabajo

### Tipos de mantenimiento según UNE-EN ISO 14224:2016
- **Preventivo** (antes del fallo): basado en condición (monitoreo de condición, búsqueda de fallos) o predeterminado (restauración programada, reemplazo programado, revisiones programadas).
- **Correctivo** (después del fallo): diferido o inmediato.

### Ciclo que conecta el trabajo con la mejora continua
Identificación de tareas → Planificación del trabajo → Programación del trabajo → Ejecución del trabajo → Historia del trabajo → Análisis y evaluación (de aquí se deriva el cálculo de indicadores) → de nuevo identificación de tareas.

### Notificación (identificación de tarea)
Es el principal medio de "comunicación" de eventos de mantenimiento entre las áreas de la empresa que requieren una acción de reparación o modificación por parte de mantenimiento. Contiene: día / hora / reportado por; descripción y objetos técnicos; posición del aviso (parte, daño, causa); actividades (operación y ejecutor); tareas de mantenimiento y fechas.
Tipos de notificación: parada, mantenimiento, producción, predictivo, inspección, seguridad, mejora, proyectos, taller, locativa.

### De la notificación a la orden cerrada
Notificación → Aprobación → OT abierta → Planeación → Programación → Ejecución → Reporte → Cierre. Sin importar si la notificación proviene de producción, seguridad, taller o un proyecto, todas pasan por aprobación antes de convertirse en una Orden de Trabajo (OT). Ese punto de control es clave: evita ejecutar trabajo no autorizado y perder trazabilidad de costos.

### Orden de mantenimiento (OT)
Incluye la información necesaria para planificar, programar y ejecutar las tareas, junto con los costos de mano de obra, materiales y otros gastos. Partes: 1) Encabezado (tipo de orden, fechas, planta, objetivo principal, prioridad, descripción); 2) Lista de objeto (equipo, ubicación técnica, avisos relacionados); 3) Operaciones y materiales (centro de trabajo, tiempo planeado, tipo de actividad, salarios, lista de materiales); 4) Costo (estimado / planeado / actual — base para el CMF y el CPMV).
Caso: un tractor D10T presenta vibración anormal en el sistema hidráulico, sigue operando con menor rendimiento y sin riesgo inmediato de seguridad. Pistas: vibración anormal → monitoreo de condición; sigue operando → no requiere parada inmediata (diferido); bajo rendimiento hoy → riesgo de fallo mayor a futuro; prevención → análisis de vibraciones periódico.

### Indicadores: medir para decidir
Métricas que evalúan el rendimiento y la eficiencia de las actividades de mantenimiento: optimizan procesos, mejoran la productividad y reducen costos.
- Propósito: controlar los procesos del negocio; medir el progreso del mejoramiento; estudiar el "ambiente" de los procesos; desempeño basado en compensaciones; realimentar entrenamiento y mejoramiento.
- Uso: enfocar la atención en los hechos clave; hacer los resultados visibles a todos; dar visión clara de las causas de desviaciones; observar tendencias, no solo valores absolutos; enfocar las posibilidades de ajuste y mejora.
- Los 8 indicadores clave: MTBF (tiempo medio entre fallas), MTTR (tiempo medio de reparación), Disponibilidad (% del tiempo operando), Confiabilidad (probabilidad de operar sin fallos), Backlog (trabajo pendiente vs. capacidad), CMF (costo de mantenimiento / facturación), CPMV (costo de mantenimiento / valor de reposición), Distribución (% por tipo de mantenimiento).

### MTBF — tiempo medio entre fallas
Mide el tiempo promedio de funcionamiento entre fallas de un equipo. Es clave para evaluar su confiabilidad y se gestiona mejor por equipo individual.
**MTBF = suma de horas en buen estado / N.º de averías (mantenimiento correctivo).**
Ejemplo: un motor eléctrico operó 140 h hasta su primer fallo, 190 h hasta el segundo y 215 h hasta el tercero: MTBF = (140 + 190 + 215) / 3 = 181,6 h.
Conclusiones: conociendo el MTBF se puede programar el mantenimiento preventivo y las inspecciones al 70 % de ese tiempo. Un MTBF más alto indica menos fallas y mayor fiabilidad.
Errores a evitar: sumar el MTBF de todos los equipos para hallar una media global; calcular el MTBF en equipos irreparables; poner a cero el MTBF cada mes (debería acumularse).

### MTTR — tiempo medio de reparación
Mide el tiempo promedio de reparación tras una falla; está ligado a la mantenibilidad. A diferencia del MTBF, un MTTR más bajo es mejor.
**MTTR = Σ tiempos de reparación / N.º de intervenciones.**
Ejemplo (mismo motor): fallo 1: 9 h; fallo 2: 15 h; fallo 3: 12 h → MTTR = (9 + 15 + 12) / 3 = 12 h. Con un costo de $950/h, la falla representó ≈ $11.400 de lucro cesante.
Errores a evitar: no existe un valor ideal o de referencia único para el MTTR; exigir un MTTR bajo a toda costa puede inducir errores en la reparación. Es mejor evitar averías que reducir el MTTR: usar técnicas predictivas para diagnosticar en tiempo real y prevenir fallas críticas.

### Disponibilidad y confiabilidad: presente y futuro del equipo
- **Disponibilidad:** capacidad del equipo de funcionar en un momento dado. **D = MTBF / (MTBF + MTTR) × 100.** Ejemplo: D = 181,6 / (181,6 + 12) × 100 = 93,8 %. Clase mundial: disponibilidad por encima del 90 %.
- **Confiabilidad:** probabilidad de que el equipo siga funcionando en el futuro. **R(t) = e^(−λ·t)**, con λ = 1/MTBF (tasa de falla), t = tiempo, e = número de Euler (2,71). Ejemplo (168 h = 1 semana): R = e^(−0,0055 × 168) = 39,69 % de probabilidad de operar sin fallas la próxima semana.
- Errores a evitar: indicar la confiabilidad sin ligarla a un período de tiempo definido; usar esta fórmula para equipos irreparables (en ese caso se requiere análisis de Weibull).

### Backlog
Tiempo de mano de obra necesario para completar todo el trabajo pendiente en el programa de mantenimiento. El gráfico de backlog (eje vertical: backlog; horizontal: meses) es crucial para la toma de decisiones a nivel ejecutivo. Seis tipos de curva:
- A: estable, requiere análisis.
- B: disminuye la demanda, puede dejar al personal sin trabajo.
- C: aumento constante, puede indicar baja calidad de mantenimiento.
- D: aumento brusco, relacionado con mantenimientos correctivos largos.
- E: caída brusca, puede deberse a contratación externa o ajustes internos.
- F: oscilación, típica en industrias estacionales como la agricultura.
Es un error común asociar el backlog solo con "actividad atrasada": abarca todas las actividades que deben realizarse, desde las más urgentes hasta las tareas rutinarias del día a día.

### CMF — costo de mantenimiento sobre la facturación
Los indicadores de costos muestran el impacto del mantenimiento en el rendimiento empresarial. El costo de mantenimiento incluye personal, materiales, servicios externos, depreciación y pérdida de facturación. Un alto costo puede elevar el precio del producto y reducir la competitividad. **CMF = costo de mantenimiento / facturación.**
Ejemplo: empresa textil con $200 mil de mantenimiento y $5 millones de facturación bruta → CMF = 4 %. En la industria textil el promedio es 1 %, así que gasta cuatro veces más. Según ABRAMAN, en promedio el 4 % de la facturación se destina al mantenimiento en las empresas del país.

### CPMV — costo de mantenimiento sobre valor de reposición
Evalúa si es más rentable mantener un equipo o reemplazarlo; útil para equipos críticos. Se basa en el costo de mantenimiento y el Valor Estimado de Reemplazo (ERV), el capital necesario para comprar un equipo nuevo. **CPMV = costo de mantenimiento / valor de reposición.**
Ejemplo: $750 en mantenimiento de un puente rodante cuyo valor nuevo es US$36 mil → CPMV = 2,08 %. Máximo aceptable: 6 % anual, aunque en algunos casos 2,5 % ya es considerable; si se supera, es mejor comprar un equipo nuevo. La mejor manera de reducir gastos es minimizar los correctivos y adoptar un enfoque predictivo.

### Distribución por tipos de mantenimiento
Porcentaje de aplicación de cada tipo de mantenimiento; el tipo de instalación o equipo puede determinar variaciones. El gestor debe limitar los correctivos no planeados al 20 % o menos. El preventivo en México suele estar entre 30 % y 40 %, mientras que globalmente se prioriza el predictivo.

### Actividad de la semana 5
Con las órdenes de trabajo de una flota asignada (un equipo por integrante): 1) clasificar las OT en preventivas, predictivas y correctivas; 2) calcular % de trabajos planeados vs. no planeados, horas en planeados vs. no planeados, disponibilidad total (preventivo y correctivo), MTTR, MTBF y MTBS (investigar); 3) visualizar con gráfico circular por tipo y gráfico de barras de la disponibilidad diaria. Solo datos del último mes; si hay menos de 40 tareas, analizar las últimas 40.

Referencias de la semana: Hernández, G. (2024), Introducción a la ingeniería de mantenimiento, Stork Technical Services; Tractian, 8 indicadores indispensables para la gestión del mantenimiento; ISO 55000:2014.`;
