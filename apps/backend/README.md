# Backend (simulador-api-ia)

API backend del MVP para gestión de proyectos/endpoints y mock server dinámico.

## Variables de entorno

Copiá `.env` y asegurate de definir:

- `DATABASE_URL` (PostgreSQL)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional, default `gpt-4.1-mini`)
- `MOCK_BASE_URL` (opcional, default `http://localhost:3000/mock`)

## Scripts útiles

- `pnpm --dir apps/backend dev` — desarrollo
- `pnpm --dir apps/backend lint` — lint
- `pnpm --dir apps/backend test` — tests
- `pnpm --dir apps/backend db:test:up` — levanta Postgres de testing (Docker)
- `pnpm --dir apps/backend test:db` — corre integración con DB real
- `pnpm --dir apps/backend db:test:down` — baja y limpia Postgres de testing
- `pnpm --dir apps/backend prisma:generate` — generar cliente Prisma
- `pnpm --dir apps/backend prisma:migrate` — migraciones de desarrollo

### Testing con DB real

El flujo recomendado para verify fuerte es:

1. `pnpm --dir apps/backend db:test:up`
2. `pnpm --dir apps/backend test:db`
3. `pnpm --dir apps/backend db:test:down`

`test:db` usa por default:

`postgresql://postgres:postgres@localhost:54329/simulador_api_test?schema=public`

Podés overridear con `DATABASE_URL_TEST`.

## Endpoints clave

- Health: `GET /health`
- Projects: `GET/POST/PATCH/DELETE /api/v1/projects`
- Endpoints: `GET/POST/PATCH/DELETE /api/v1/projects/:projectId/endpoints`
- Scenarios: `GET/POST/PATCH/DELETE /api/v1/endpoints/:endpointId/scenarios`
- Endpoint Config: `GET/PUT /api/v1/endpoints/:endpointId/config`
- Global Config: `GET/PUT /api/v1/projects/:projectId/config`
- Logs: `GET/DELETE /api/v1/projects/:projectId/logs`
- AI Generate: `POST /api/v1/projects/:projectId/endpoints/ai-generate`
- Mock Runtime: `ANY /mock/:projectSlug/*`
