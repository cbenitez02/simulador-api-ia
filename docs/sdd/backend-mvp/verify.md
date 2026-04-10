# Backend MVP — Verify Report

Proyecto: `simulador-api-ia`
Cambio: `backend-mvp`
Fecha: `2026-04-04`
Etapa SDD: `verify (completada)`

---

## 1) Evidencia ejecutada

- `pnpm --dir apps/backend lint` ✅
- `pnpm --dir apps/backend exec prisma validate --schema prisma/schema.prisma` ✅
- `pnpm --dir apps/backend test` ✅
  - 5 archivos (1 suite DB marcada `skip` si `RUN_DB_TESTS` no está activo)
  - 22 tests
  - 100% pass local
- `pnpm --dir apps/backend test:db` ✅
  - pipeline de DB real ejecutado completo (generate + migrate + vitest)
  - PostgreSQL efímero levantado con Docker Compose en `localhost:54329`
  - 1 archivo DB integration, 4 tests, todos OK

---

## 2) Cobertura verificada contra Spec/Design

### Projects

- CRUD expuesto por router `management/projects` ✅
- Generación de slug con deduplicación incremental y reservados ✅
- Autocreación de `GlobalConfig` en transacción ✅

### Endpoints

- CRUD expuesto por router `management/endpoints` ✅
- Unicidad `(projectId, method, path)` con conflicto 409 ✅
- Autocreación de `EndpointConfig` en transacción ✅

### Scenarios

- CRUD expuesto por router `management/scenarios` ✅
- Validaciones de `type`, `statusCode`, `delayMs`, `weight` ✅

### EndpointConfig / GlobalConfig

- GET/PUT disponibles ✅
- Validaciones de rangos y consistencia (`min <= max`, rate 0..1) ✅

### Mock Server

- Resolución por slug + method + path ✅
- Selección de escenario weighted/uniform/direct ✅
- Headers `X-Simulador-Scenario` y `X-Simulador-Latency` ✅
- Latencia con override global (`scope=all`) ✅
- Forced error simulation global ✅

### Logs

- Persistencia de log en modo fire-and-forget ✅
- API de logs por proyecto (`GET` últimos 100, `DELETE` purge) ✅

### AI Generate (OpenAI)

- Endpoint `/api/v1/projects/:projectId/endpoints/ai-generate` ✅
- Validación Zod estricta de payload IA ✅
- Timeout 30s + reintento único ✅

---

## 3) Gaps / Riesgos abiertos

1. **Rate limiting**: el reporte original lo dejó marcado como gap aceptado del MVP porque en ese momento faltaba enforcement runtime; hoy esa afirmación quedó stale, ya que el runtime actual sí aplica límites y expone headers/cuando corresponde bloqueos 429.

---

## 4) Conclusión

Estado actual: **verify cerrada** para MVP core (estructura, rutas, runtime, IA, logs, validaciones, tests unitarios + integración mockeada + integración con DB real).

Siguiente etapa recomendada: **archive**.
