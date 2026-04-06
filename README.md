# Simulador API IA

Monorepo para diseñar, administrar y ejecutar APIs mockeadas con soporte para proyectos, endpoints, escenarios, configuración global, logs y generación asistida por IA.

El repo está dividido en dos aplicaciones principales:

- **`apps/web`**: interfaz Angular para operar el simulador
- **`apps/backend`**: API de gestión + runtime de mocks + persistencia

## Estructura del repo

```text
.
├── apps/
│   ├── web/        # Frontend Angular 21
│   └── backend/    # API backend + mock runtime + Prisma/PostgreSQL
├── docs/
│   └── sdd/        # Artefactos y documentación del flujo SDD
├── libs/           # Espacio para librerías compartidas
└── .github/        # Workflows y automatización
```

## Stack

- **Workspace:** pnpm
- **Frontend:** Angular 21, Angular Material, Vitest
- **Backend:** Node.js, Express 5, Prisma, PostgreSQL, Zod
- **CI:** GitHub Actions

## Qué podés hacer con el proyecto

- crear, editar y eliminar proyectos
- definir endpoints manuales y escenarios
- configurar comportamiento global del mock por proyecto
- inspeccionar logs de requests simuladas
- exponer mocks accesibles por URL
- generar estructuras iniciales vía IA desde backend

## Requisitos

- Node.js 22+
- pnpm 10+
- Docker Desktop o PostgreSQL local

## Instalación

Desde la raíz:

```bash
pnpm install
```

## Quick start local

### 1. Levantar PostgreSQL

La opción más simple y reproducible es usar Docker desde `apps/backend`:

```bash
cd apps/backend
docker compose -f docker-compose.test.yml up -d
```

### 2. Configurar backend

Asegurate de tener un `.env` válido en `apps/backend/.env`.

Ejemplo mínimo:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/simulador_api"
OPENAI_API_KEY="test-key-local-dev"
OPENAI_MODEL="gpt-4.1-mini"
MOCK_BASE_URL="http://localhost:3000/mock"
PORT=3000
NODE_ENV=development
```

Aplicá migraciones:

```bash
pnpm --dir apps/backend exec prisma migrate deploy --schema prisma/schema.prisma
```

Levantá el backend:

```bash
pnpm --dir apps/backend dev
```

Backend local:

- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`

### 3. Levantar frontend

Levantá el frontend:

```bash
pnpm --dir apps/web exec ng serve --host 127.0.0.1 --port 4200 --no-open
```

Frontend local:

- Web: `http://127.0.0.1:4200`

## Scripts útiles

### Raíz

```bash
pnpm lint
pnpm format:check
pnpm test
```

### Frontend

```bash
pnpm --dir apps/web start
pnpm --dir apps/web build
pnpm --dir apps/web test
pnpm --dir apps/web exec tsc --project tsconfig.app.json --noEmit
pnpm --dir apps/web exec tsc --project tsconfig.spec.json --noEmit
```

### Backend

```bash
pnpm --dir apps/backend dev
pnpm --dir apps/backend lint
pnpm --dir apps/backend test
pnpm --dir apps/backend test:db
pnpm --dir apps/backend prisma:generate
pnpm --dir apps/backend prisma:migrate
```

## CI actual

El workflow principal valida:

- backend lint + tests
- frontend lint + typecheck app/spec + tests headless
- integración backend con DB
- shellcheck

## Flujo recomendado de trabajo

1. levantar backend y frontend en local
2. validar cambios con tests/checks acotados por app
3. abrir PR contra `dev`
4. dejar que CI valide frontend y backend

## Documentación por app

- [Frontend (`apps/web/README.md`)](apps/web/README.md)
- [Backend (`apps/backend/README.md`)](apps/backend/README.md)

## Endpoints principales del backend

- `GET /health`
- `GET/POST/PATCH/DELETE /api/v1/projects`
- `GET/POST/PATCH/DELETE /api/v1/projects/:projectId/endpoints`
- `GET/POST/PATCH/DELETE /api/v1/endpoints/:endpointId/scenarios`
- `GET/PUT /api/v1/endpoints/:endpointId/config`
- `GET/PUT /api/v1/projects/:projectId/config`
- `GET/DELETE /api/v1/projects/:projectId/logs`
- `POST /api/v1/projects/:projectId/endpoints/ai-generate`
- `ANY /mock/:projectSlug/*`

## Notas importantes

- El repo usa **pnpm**; evitá mezclarlo con `npm` o `package-lock.json`.
- La integración con OpenAI requiere una key real si querés usar IA de verdad.
- Los cambios grandes del repo se vienen trabajando con **SDD (Spec-Driven Development)**.
- La rama de integración del equipo hoy es **`dev`**.
