# Backend MVP — Archive Report

Proyecto: `simulador-api-ia`
Cambio: `backend-mvp`
Fecha: `2026-04-04`
Etapa SDD: `archive (completada)`

---

## Objetivo del cambio

Implementar el backend MVP de simulación de APIs con:

- gestión de proyectos/endpoints/scenarios,
- mock runtime configurable,
- logging de requests,
- configuración global y por endpoint,
- generación de endpoints con IA (OpenAI GPT),
- validación y cobertura de tests (incluyendo DB real).

---

## Estado final del ciclo SDD

- `proposal ✅`
- `spec ✅`
- `design ✅`
- `tasks ✅`
- `apply ✅`
- `verify ✅`
- `archive ✅`

---

## Evidencia de cierre

- `pnpm --dir apps/backend lint` ✅
- `pnpm --dir apps/backend test` ✅ (unit + integration mock)
- `pnpm --dir apps/backend test:db` ✅ (PostgreSQL real con Docker)
- `pnpm --dir apps/backend exec prisma validate --schema prisma/schema.prisma` ✅

---

## Entregables principales

### Backend Core

- Base técnica: env, prisma singleton, middleware global de errores.
- Prisma schema + migración inicial con modelos MVP.
- Rutas de management para projects, endpoints, scenarios, configs y logs.

### Mock Runtime

- Resolución por `projectSlug + method + path`.
- Selección de escenarios weighted/uniform/direct.
- Latencia por escenario/endpoint/global con prioridad definida.
- Error simulation global configurable.
- Headers de trazabilidad (`X-Simulador-Scenario`, `X-Simulador-Latency`).

### IA (OpenAI)

- Endpoint `POST /api/v1/projects/:projectId/endpoints/ai-generate`.
- Validación Zod estricta del payload generado.
- Timeout de servicio + reintento único.

### Testing y DX

- Suite de tests unitarios + integración HTTP.
- Suite de integración con DB real (docker compose de test + runner dedicado).
- README de backend actualizado con scripts y flujo de validación.

---

## Gaps aceptados (fuera de alcance MVP)

1. Al cierre original del MVP, `rateLimitingEnabled` y `rateLimitingRpm` se documentaron como gap porque faltaba enforcement runtime; hoy esa limitación ya no aplica porque el runtime sí ejecuta rate limiting, así que este punto queda sólo como contexto histórico.

---

## Próximas líneas recomendadas

1. Extender el rate limiting actual con políticas más avanzadas por proyecto/endpoint si el producto lo requiere.
2. Agregar métricas operativas (p95 latency, error ratio por endpoint).
3. Incorporar suite de contrato API (OpenAPI + validación automática de responses).
