// Glosario en lenguaje sencillo: cada palabra técnica que aparece en la plataforma, explicada para alguien que nunca la ha usado.

export interface GlossaryTerm {
  term: string;
  short: string;
  more?: string;
}

export const GLOSSARY = {
  punto: {
    term: 'Punto de inspección',
    short: 'Un lugar fijo de la estructura que se revisa en cada inspección, por ejemplo AP-03.',
    more: 'El código dice la zona (AP = Apron, BW = Caja, EY = Eyector) y el número del punto.',
  },
  zona: {
    term: 'Zona',
    short: 'Una parte grande de la traílla: Apron (compuerta delantera), Caja (scraper bowl) o Eyector.',
  },
  l: {
    term: 'L (longitud de la grieta)',
    short: 'Lo que mide la grieta en campo, en milímetros. 0 = no hay grieta.',
  },
  caution: {
    term: 'Caution',
    short: 'Primer límite, de precaución. Si la grieta lo alcanza, el punto pasa a Alerta y hay que programar la reparación.',
  },
  danger: {
    term: 'Danger',
    short: 'Límite de operación segura. Si la grieta lo alcanza, el punto es Crítico y el equipo no debe operar hasta repararlo.',
  },
  estado: {
    term: 'Estado',
    short: 'Cómo está el punto según su última medida: Normal, Alerta, Crítico, Sin grieta o N/I.',
    more: 'Normal: la grieta es menor que Caution. Alerta: está entre Caution y Danger. Crítico: alcanzó Danger o hay fractura.',
  },
  ni: {
    term: 'N/I (no inspeccionado)',
    short: 'Ese día no se pudo medir el punto. No significa que no haya grieta: la última grieta conocida sigue ahí.',
  },
  prioridad: {
    term: 'Prioridad (P1 a P4)',
    short: 'Qué tan pronto hay que actuar. P1 = de inmediato; P2 = pronto; P3 = planear; P4 = puede esperar.',
    more: 'Combina la urgencia (cuánto falta para Danger) con la consecuencia (qué tan grave sería que ese punto fallara).',
  },
  urgencia: {
    term: 'Urgencia',
    short: 'Qué tan rápido se acerca la grieta a Danger, de 1 (lento) a 5 (ya está ahí).',
  },
  consecuencia: {
    term: 'Consecuencia',
    short: 'Qué tan grave sería que el punto fallara, de 1 a 5. La caja y la oreja de levante son 5 porque su falla es un riesgo para las personas.',
  },
  pronostico: {
    term: 'Pronóstico',
    short: 'Estimación de cómo seguirá creciendo la grieta, calculada con sus medidas anteriores.',
    more: 'La banda sombreada es el rango probable. El borde pesimista es el caso más rápido razonable: con ese se toman las decisiones.',
  },
  pesimista: {
    term: 'Pesimista y central',
    short: 'Dos estimaciones del tiempo que falta. Pesimista = si la grieta crece rápido; central = lo más probable. Se planea con la pesimista.',
  },
  horometro: {
    term: 'Horómetro',
    short: 'Horas de operación acumuladas por el equipo, como el kilometraje de un carro.',
  },
  mtbf: {
    term: 'MTBF',
    short: 'Tiempo medio entre reparaciones: horas operadas divididas entre el número de reparaciones. Más alto es mejor.',
  },
  ot: {
    term: 'OT (orden de trabajo)',
    short: 'El documento que pide, planea y registra una reparación, desde el aviso hasta el cierre.',
  },
  reincidente: {
    term: 'Reincidente',
    short: 'Punto que ya se reparó dos o más veces: la grieta vuelve, así que soldar otra vez no basta y hay que buscar la causa.',
  },
  causaRaiz: {
    term: 'Análisis de causa raíz',
    short: 'Buscar por qué aparece la grieta (diseño, carga, soldadura, operación) para corregirlo y que no vuelva.',
  },
  matriz: {
    term: 'Matriz de riesgo',
    short: 'Tabla de 5 × 5 que cruza urgencia y consecuencia. Arriba a la derecha está lo más peligroso.',
  },
  corte: {
    term: 'Ver el estado en otra fecha',
    short: 'Muestra la plataforma como estaba en una fecha pasada, para comparar lo que se pronosticó con lo que pasó.',
  },
  end: {
    term: 'END (ensayo no destructivo)',
    short: 'Prueba que revisa la soldadura sin dañarla (tintas, partículas magnéticas o ultrasonido) para confirmar que quedó sin grieta.',
  },
  intervalo: {
    term: 'Intervalo de inspección',
    short: 'Tiempo entre una inspección y la siguiente. El objetivo es no pasar de 700 h de operación.',
  },
  backlog: {
    term: 'Backlog',
    short: 'Trabajo pendiente, medido en horas-hombre (h-h) y en semanas de capacidad del taller.',
  },
} satisfies Record<string, GlossaryTerm>;

export type GlossaryKey = keyof typeof GLOSSARY;
