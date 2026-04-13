# Backend

API backend y runtime de mocks del simulador. Maneja proyectos, endpoints, escenarios, configuración global, logs y generación asistida por IA.

## Stack

- Node.js + Express 5
- Prisma
- PostgreSQL
- Zod
- Vitest

## Responsabilidades

- exponer la API de gestión
- persistir proyectos y recursos asociados
- servir el mock runtime por proyecto
- registrar logs de requests
- generar borradores de endpoints vía IA (`ai-preview`) y persistir endpoints asistidos (`ai-generate`)

## Estructura principal

```text
apps/backend/src/
├── app.ts
├── server.ts
├── config/
├── lib/
├── management/
├── middleware/
├── mock-server/
└── __tests__/
```

## Variables de entorno

El backend carga variables desde `apps/backend/.env`.

Para una checklist más operativa de preparación de entorno y validaciones de arranque, ver `../../docs/deployment-readiness.md`.

```bash
cp apps/backend/.env.example apps/backend/.env
```

> En PowerShell: `Copy-Item apps/backend/.env.example apps/backend/.env`

Ejemplo base:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/simulador_api?schema=public"
OPENAI_MODEL="gpt-4.1-mini"
MOCK_BASE_URL="http://localhost:3000/mock"
CORS_ALLOWED_ORIGINS="http://127.0.0.1:4200,http://localhost:4200"
PORT=3000
NODE_ENV=development
```

### Notas

- `DATABASE_URL` es obligatoria.
- `OPENAI_API_KEY` es opcional para boot. Solo configurala si vas a usar endpoints asistidos por IA.
- `OPENAI_MODEL`, `MOCK_BASE_URL`, `PORT` y `NODE_ENV` tienen defaults en código, pero conviene dejarlos explícitos en `.env` para onboarding.
- `CORS_ALLOWED_ORIGINS` acepta una lista separada por comas. Si no se define, en `development`/`test` se permiten orígenes `localhost` y `127.0.0.1`; en `production`, el backend no habilita CORS para orígenes arbitrarios del navegador.
- El rate limiting del mock runtime usa contadores persistidos en PostgreSQL por proyecto/ventana, así que no depende exclusivamente de memoria local del proceso.
- `loggingLevel=full` persiste bodies completos de request/response; `basic` omite esos cuerpos para bajar costo y volumen de logs.
- El backend ahora expone `GET /ops/health` con métricas operativas básicas (`projects`, `endpoints`, `logs`) y propaga `X-Request-Id` para correlación mínima de requests.
- Los errores no controlados se emiten con logging estructurado mínimo (`event`, `requestId`, `message`, `name`) para dejar evidencia utilizable fuera de desarrollo.

## Observabilidad operativa mínima

- `GET /health` sigue siendo un liveness check simple.
- `GET /ops/health` entrega una señal operativa mínima con conteos básicos y timestamp.
- `X-Request-Id` se devuelve en responses para correlación mínima entre cliente, logs y errores.
- La retención de logs funcionales hoy depende de la tabla `ApiLog`; si el volumen crece, la política de cleanup/archivado debe evolucionar explícitamente.

## Base de datos local

El repo trae un compose reutilizable:

```bash
pnpm --dir apps/backend db:test:up
```

Eso levanta PostgreSQL en `localhost:54329` y crea la base `simulador_api_test`.

Para desarrollo local del backend, creá además una base como `simulador_api` y apuntá `DATABASE_URL` a esa base.

## Arranque local

Desde la raíz del monorepo:

```bash
pnpm --dir apps/backend prisma:generate
pnpm --dir apps/backend exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --dir apps/backend dev
```

Servidor local:

```text
http://localhost:3000
```

Endpoints útiles:

- `GET /health`
- `ANY /mock/:projectSlug/*`

## Migraciones y Prisma

```bash
pnpm --dir apps/backend prisma:generate
pnpm --dir apps/backend exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --dir apps/backend prisma:migrate
pnpm --dir apps/backend prisma:studio
```

## Scripts útiles

```bash
pnpm --dir apps/backend dev
pnpm --dir apps/backend lint
pnpm --dir apps/backend test
pnpm --dir apps/backend test:coverage
pnpm --dir apps/backend test:watch
pnpm --dir apps/backend test:db
pnpm --dir apps/backend db:test:up
pnpm --dir apps/backend db:test:down
```

## Testing con DB real

Flujo recomendado:

```bash
pnpm --dir apps/backend db:test:up
pnpm --dir apps/backend test:db
pnpm --dir apps/backend db:test:down
```

Por default, `test:db` usa:

```text
postgresql://postgres:postgres@localhost:54329/simulador_api_test?schema=public
```

Podés overridear con `DATABASE_URL_TEST`.

## Dónde tocar según el caso

- **API y bootstrap**: `src/app.ts`, `src/server.ts`
- **config/env**: `src/config/`
- **Prisma y acceso a DB**: `src/lib/`, `prisma/`
- **módulos de negocio**: `src/management/`
- **runtime de mocks**: `src/mock-server/`
- **tests**: `src/__tests__/`

## Consideraciones actuales

- el MVP canoniza opciones todavía no soportadas: `GlobalConfig.scope` siempre se persiste como `all` y `EndpointConfig.errorRate` siempre vuelve en `0`
- cuando la latencia global está habilitada, aplica a todo el runtime del proyecto aunque existan valores legacy de `scope`
- la UI mantiene esos controles visibles pero deshabilitados y marcados como `Próximamente` para no prometer soporte inexistente
- el backend expone dos rutas asistidas por IA: `POST /api/v1/projects/:projectId/endpoints/ai-preview` devuelve un draft normalizado sin persistir y `POST /api/v1/projects/:projectId/endpoints/ai-generate` crea el endpoint completo
- sin `OPENAI_API_KEY` real, ambas rutas asistidas van a responder como no disponibles
- la CI del repo valida lint, tests e integración DB del backend
