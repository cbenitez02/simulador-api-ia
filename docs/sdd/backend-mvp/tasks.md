# Backend MVP — SDD Tasks

Proyecto: `simulador-api-ia`
Cambio: `backend-mvp`
Estado actual del SDD: `proposal ✅ | spec ✅ | design ✅ | tasks ✅ | apply ✅ | verify ✅ | archive ✅`
Progreso apply: `TASK-001 ✅ | TASK-002 ✅ | TASK-003 ✅ | TASK-004 ✅ | TASK-005 ✅ | TASK-006 ✅ | TASK-007 ✅ | TASK-008 ✅ | TASK-009 ✅ | TASK-010 ✅ | TASK-011 ✅ | TASK-012 ✅ | TASK-013 ✅ | TASK-014 ✅`

---

## Reglas de ejecución

- Convención de estructura: `apps/backend/src/<modulo>/{schema.ts,service.ts,router.ts}`.
- No introducir capa controller extra (router fino + service puro).
- Mock router SIEMPRE al final del montaje en `app.ts`.
- Logging del mock en modo _fire-and-forget_ (no bloquear response).
- No correr build. Validar con tests/lint/checks livianos por módulo.

---

## Checklist atómico de implementación

### TASK-001 (Bloqueante)

**Objetivo:** Base técnica del backend (Prisma singleton, env, errores globales).

**Archivos esperados:**

- `apps/backend/src/lib/prisma.ts`
- `apps/backend/src/config/env.ts` (actualización)
- `apps/backend/src/middleware/error-handler.ts`
- `apps/backend/src/app.ts` (hook de error middleware)

**Criterios de aceptación:**

- Existe singleton de Prisma que evita múltiples clientes en dev/hot reload.
- `OPENAI_API_KEY` se valida al boot con Zod.
- Error handler mapea: Zod→400, AppError→status custom, Prisma P2002→409, P2025→404, fallback→500.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-002 (Bloqueante)

**Objetivo:** Modelado de datos MVP en Prisma + migración inicial backend-mvp.

**Archivos esperados:**

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/*`

**Criterios de aceptación:**

- Modelos presentes: `Project`, `Endpoint`, `Scenario`, `EndpointConfig`, `GlobalConfig`, `ApiLog`.
- Relaciones y cascadas alineadas al design.
- Índice de logs por `(projectId, createdAt desc)`.
- `@@unique([projectId, method, path])` en `Endpoint`.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-003 (Bloqueante)

**Objetivo:** Implementar módulo `management/projects` con slug + autocreación de `GlobalConfig`.

**Archivos esperados:**

- `apps/backend/src/management/projects/schema.ts`
- `apps/backend/src/management/projects/service.ts`
- `apps/backend/src/management/projects/router.ts`
- `apps/backend/src/management/projects/slug.ts`

**Criterios de aceptación:**

- CRUD Projects completo.
- Slug generado automáticamente, único y con slugs reservados bloqueados.
- `PATCH` no permite mutar slug.
- `POST` crea `GlobalConfig` default en la misma transacción.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-004 (Bloqueante)

**Objetivo:** Montaje inicial de rutas y checkpoint de gestión de proyectos.

**Archivos esperados:**

- `apps/backend/src/app.ts`

**Criterios de aceptación:**

- `GET /health` operativo.
- Router de projects montado bajo `/api/v1/projects`.
- Middleware de errores montado al final.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-005 (Bloqueante)

**Objetivo:** Implementar módulo `management/endpoints` con autocreación de `EndpointConfig`.

**Archivos esperados:**

- `apps/backend/src/management/endpoints/schema.ts`
- `apps/backend/src/management/endpoints/service.ts`
- `apps/backend/src/management/endpoints/router.ts`

**Criterios de aceptación:**

- CRUD Endpoints para un `projectId`.
- Unicidad `(projectId, method, path)` validada y con respuesta 409.
- `method` y `path` no mutables en `PATCH`.
- `POST` crea `EndpointConfig` default en transacción.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-006 (Bloqueante)

**Objetivo:** Implementar módulo `management/scenarios`.

**Archivos esperados:**

- `apps/backend/src/management/scenarios/schema.ts`
- `apps/backend/src/management/scenarios/service.ts`
- `apps/backend/src/management/scenarios/router.ts`

**Criterios de aceptación:**

- CRUD Scenarios por endpoint.
- Validaciones: `weight >= 1`, `delayMs >= 0`, `statusCode` válido, `type` permitido.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-007 (Bloqueante)

**Objetivo:** Implementar mock server runtime (lookup, selección de escenario, latencia, respuesta).

**Archivos esperados:**

- `apps/backend/src/mock-server/mock.router.ts`
- `apps/backend/src/mock-server/scenario-selector.ts`
- `apps/backend/src/mock-server/latency.ts`

**Criterios de aceptación:**

- Router catch-all bajo `/mock` montado al final.
- Lookup por `(projectSlug, method, path)`.
- Soporte de selección weighted random y fallback a endpoint default.
- Headers: `X-Simulador-Scenario` y `X-Simulador-Latency`.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-008 (Bloqueante)

**Objetivo:** Implementar logging fire-and-forget para requests del mock.

**Archivos esperados:**

- `apps/backend/src/mock-server/logger.ts`
- `apps/backend/src/management/logs/schema.ts`
- `apps/backend/src/management/logs/service.ts`
- `apps/backend/src/management/logs/router.ts`

**Criterios de aceptación:**

- El mock responde sin await al guardado de logs.
- Fallos de log no rompen el response.
- `GET /api/v1/projects/:projectId/logs` devuelve últimos 100.
- `DELETE /api/v1/projects/:projectId/logs` limpia todos los logs.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-009 (Bloqueante)

**Objetivo:** Implementar configuración por endpoint (`EndpointConfig`).

**Archivos esperados:**

- `apps/backend/src/management/endpoint-config/schema.ts`
- `apps/backend/src/management/endpoint-config/service.ts`
- `apps/backend/src/management/endpoint-config/router.ts`

**Criterios de aceptación:**

- `GET` y `PUT` para config por endpoint.
- Validación `minDelayMs <= maxDelayMs`.
- `errorRate` en rango [0,1].

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-010 (Bloqueante)

**Objetivo:** Implementar configuración global por proyecto (`GlobalConfig`).

**Archivos esperados:**

- `apps/backend/src/management/global-config/schema.ts`
- `apps/backend/src/management/global-config/service.ts`
- `apps/backend/src/management/global-config/router.ts`

**Criterios de aceptación:**

- `GET` y `PUT` por `projectId`.
- Validación de `errorSimulationCodes` y `errorSimulationRate`.
- Campos default consistentes con spec.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-011 (Bloqueante)

**Objetivo:** Integrar `GlobalConfig` en runtime mock (override latencia + error simulation).

**Archivos esperados:**

- `apps/backend/src/mock-server/mock.router.ts`
- `apps/backend/src/mock-server/latency.ts`

**Criterios de aceptación:**

- Prioridad de latencia consistente y explícita.
- Error simulation forzado configurable con códigos aleatorios válidos.
- `scenarioSelectionSource` reflejado correctamente en log.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-012 (Bloqueante)

**Objetivo:** Implementar AI generate endpoint (OpenAI GPT + validación Zod + reintento único).

**Archivos esperados:**

- `apps/backend/src/management/ai/schema.ts`
- `apps/backend/src/management/ai/service.ts`
- `apps/backend/src/management/ai/router.ts`

**Criterios de aceptación:**

- `POST /api/v1/projects/:projectId/endpoints/ai-generate` operativo.
- Respuesta IA validada por schema estricto.
- Si IA falla parseo: 1 reintento; luego 422.
- Timeout de servicio IA: 504.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-013 (Bloqueante)

**Objetivo:** Cobertura de tests de integración del flujo MVP completo.

**Archivos esperados:**

- `apps/backend/src/**/__tests__/*.test.ts` (o convención local de tests)

**Criterios de aceptación:**

- Casos mínimos cubiertos: projects CRUD, endpoints CRUD, scenarios CRUD, mock runtime (weighted/direct/not-found), logs fire-and-forget, AI happy-path + failure path.
- Tests deterministas para weighted random (stub de `Math.random`).

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

### TASK-014 (No bloqueante)

**Objetivo:** Endurecimiento de observabilidad y DX.

**Archivos esperados:**

- `apps/backend/src/app.ts`
- `apps/backend/src/config/*`
- `apps/backend/README.md` (si aplica)

**Criterios de aceptación:**

- Mensajes de error consistentes.
- Variables de entorno documentadas.
- Logging dev razonable y no verboso en test.

**Comando recomendado de validación:**

- `pnpm --dir apps/backend test`

---

## Dependencias y paralelización

### Cadena bloqueante principal

`TASK-001 → TASK-002 → TASK-003 → TASK-004 → TASK-005 → TASK-006 → TASK-007 → TASK-008 → TASK-009 → TASK-010 → TASK-011 → TASK-012 → TASK-013`

### Paralelizables (una vez superados bloqueos)

- `TASK-008` (logs API) puede avanzar en paralelo con `TASK-009` y `TASK-010` tras `TASK-007`.
- `TASK-014` puede hacerse en paralelo al cierre de `TASK-013`.

---

## MVP Slice inicial (arranque inmediato)

1. **TASK-001** — Base técnica.
2. **TASK-002** — Prisma + migración.
3. **TASK-003** — Projects CRUD + slug + GlobalConfig default.

Con ese slice ya queda el primer vertical funcional del backend de management para empezar a validar con frontend/API client.
