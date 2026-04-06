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
- generar estructuras de endpoints vía IA

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

Copiá o creá `apps/backend/.env` y definí al menos:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/simulador_api"
OPENAI_API_KEY="test-key-local-dev"
OPENAI_MODEL="gpt-4.1-mini"
MOCK_BASE_URL="http://localhost:3000/mock"
PORT=3000
NODE_ENV=development
```

### Notas

- `DATABASE_URL` es obligatoria.
- `OPENAI_API_KEY` hoy también es requerida al arrancar; para desarrollo local puede usarse una dummy si no vas a probar IA real.
- `MOCK_BASE_URL` define la base usada para URLs del mock runtime.

## Base de datos local

El repo ya trae un compose reutilizable:

```bash
cd apps/backend
docker compose -f docker-compose.test.yml up -d
```

Eso levanta PostgreSQL en `localhost:54329`.

Si necesitás la base `simulador_api`, creala dentro del contenedor y después aplicá migraciones.

## Arranque local

Desde la raíz:

```bash
pnpm --dir apps/backend dev
```

Servidor local:

```text
http://localhost:3000
```

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
pnpm --dir apps/backend build
pnpm --dir apps/backend start
pnpm --dir apps/backend lint
pnpm --dir apps/backend test
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

## Endpoints clave

- `GET /health`
- `GET/POST/PATCH/DELETE /api/v1/projects`
- `GET/POST/PATCH/DELETE /api/v1/projects/:projectId/endpoints`
- `GET/POST/PATCH/DELETE /api/v1/endpoints/:endpointId/scenarios`
- `GET/PUT /api/v1/endpoints/:endpointId/config`
- `GET/PUT /api/v1/projects/:projectId/config`
- `GET/DELETE /api/v1/projects/:projectId/logs`
- `POST /api/v1/projects/:projectId/endpoints/ai-generate`
- `ANY /mock/:projectSlug/*`

## Dónde tocar según el caso

- **API y bootstrap**: `src/app.ts`, `src/server.ts`
- **config/env**: `src/config/`
- **Prisma y acceso a DB**: `src/lib/`, `prisma/`
- **módulos de negocio**: `src/management/`
- **runtime de mocks**: `src/mock-server/`
- **tests**: `src/__tests__/`

## Consideraciones actuales

- el mock runtime todavía tiene deuda entre config expuesta y comportamiento real en algunas opciones avanzadas
- el backend ya soporta edición y eliminación de proyectos
- el flujo de IA existe en backend, pero todavía hay deuda de alineación end-to-end con frontend
- la CI del repo valida lint, tests e integración DB del backend
