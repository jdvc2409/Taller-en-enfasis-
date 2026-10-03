# Intermediario de IA

Función de Vercel que guarda la clave de Anthropic como secreto (`ANTHROPIC_API_KEY`) y reenvía las consultas de la plataforma. La clave nunca está en el repositorio.

- Solo acepta solicitudes desde `https://jdvc2409.github.io` (y localhost para desarrollo).
- Solo permite los modelos de la app, una pregunta por consulta y como máximo 16.000 tokens de respuesta.
- Usa siempre su propio mensaje de sistema (`lib/system.ts`, copia de `src/lib/ai.ts`).
- Admite 25 consultas por IP cada 10 minutos.

Despliegue: `cd proxy && vercel deploy --prod`. La clave se configura con `vercel env add ANTHROPIC_API_KEY production`.
