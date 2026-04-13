# Simulador API IA

Monorepo para diseñar, administrar y ejecutar APIs mockeadas con soporte para proyectos, endpoints, escenarios, configuración global, logs y generación asistida por IA.

## Qué incluye este monorepo

- **`apps/backend`**: API de gestión, runtime de mocks y persistencia con Prisma/PostgreSQL.
- **`apps/web`**: interfaz Angular para operar el simulador desde navegador.
- **`docs/sdd`**: artefactos del flujo Spec-Driven Development usado por el proyecto.
- **`libs`**: espacio reservado para código compartido.

## Estructura del repo

```text
.
├── apps/
│   ├── backend/
│   └── web/
├── docs/
│   └── sdd/
├── libs/
└── .github/
```

## Stack

- **Workspace:** pnpm
- **Frontend:** Angular 21, Angular Material, Vitest
- **Backend:** Node.js, Express 5, Prisma, PostgreSQL, Zod
- **CI:** GitHub Actions

## Prerrequisitos

- Node.js **22+**
- pnpm **10+**
- Docker Desktop **o** PostgreSQL local

## Instalación

Desde la raíz del repo:

```bash
pnpm install
```

## Variables de entorno

Para una auditoría completa del contrato runtime actual y de los supuestos locales todavía presentes, ver `docs/runtime-config-audit.md`.

Para una checklist operativa de despliegue y validación de arranque, ver `docs/deployment-readiness.md`.

Para una auditoría puntual del estado actual de las validaciones backend en CI, ver `docs/backend-ci-audit.md`.

Para las reglas mínimas de merge y release-readiness del backend, ver `docs/backend-merge-gates.md`.

### Backend

El backend carga variables desde `apps/backend/.env`.

1. Copiá el ejemplo:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

   > En PowerShell podés usar: `Copy-Item apps/backend/.env.example apps/backend/.env`

2. Valores disponibles:

| Variable               | Obligatoria                          | Uso                                                                   |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `DATABASE_URL`         | Sí                                   | Conexión Prisma/PostgreSQL para desarrollo local                      |
| `OPENAI_API_KEY`       | No para boot, sí para probar IA real | Solo hace falta si vas a usar endpoints asistidos por IA              |
| `OPENAI_MODEL`         | No                                   | Modelo usado por backend para features asistidas por IA               |
| `MOCK_BASE_URL`        | No                                   | Base pública que el backend usa al construir URLs del mock runtime    |
| `CORS_ALLOWED_ORIGINS` | No                                   | Allowlist CORS del backend para orígenes de navegador (coma separada) |
| `PORT`                 | No                                   | Puerto HTTP del backend                                               |
| `NODE_ENV`             | No                                   | Entorno de ejecución                                                  |

### Frontend

El frontend carga configuración runtime desde `apps/web/public/app-config.js`.

- si no definís nada, usa defaults locales: `http://localhost:3000/api/v1` y `http://localhost:3000/mock`
- si desplegás en otro entorno, podés reemplazar ese archivo sin rebuild y definir `window.__SIMULADOR_RUNTIME_CONFIG__`

Ejemplo:

```js
window.__SIMULADOR_RUNTIME_CONFIG__ = {
  apiBaseUrl: 'https://api.example.com/api/v1',
  mockBaseUrl: 'https://api.example.com/mock',
};
```

## Setup local paso a paso

### 1. Levantar PostgreSQL con Docker

La opción más simple es reutilizar el compose del backend:

```bash
pnpm --dir apps/backend db:test:up
```

Eso expone PostgreSQL en `localhost:54329`.

> El compose crea por default la base `simulador_api_test`. Para desarrollo local del backend conviene usar otra base, por ejemplo `simulador_api`, en el mismo servidor.

### 2. Configurar el backend

Copiá `apps/backend/.env.example` a `apps/backend/.env` y ajustá al menos `DATABASE_URL`.

Ejemplo local:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/simulador_api?schema=public"
OPENAI_MODEL="gpt-4.1-mini"
MOCK_BASE_URL="http://localhost:3000/mock"
CORS_ALLOWED_ORIGINS="http://127.0.0.1:4200,http://localhost:4200"
PORT=3000
NODE_ENV=development
```

Para entornos no locales, definí `CORS_ALLOWED_ORIGINS` explícitamente (por ejemplo `https://app.example.com,https://admin.example.com`). Si no se define en `production`, el backend no habilita CORS para orígenes arbitrarios del navegador.

Después aplicá migraciones:

```bash
pnpm --dir apps/backend prisma:generate
pnpm --dir apps/backend exec prisma migrate deploy --schema prisma/schema.prisma
```

### 3. Levantar backend

```bash
pnpm --dir apps/backend dev
```

URLs locales:

- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- Mock runtime base: `http://localhost:3000/mock`

### 4. Levantar frontend

En otra terminal:

```bash
pnpm --dir apps/web start -- --host 127.0.0.1 --port 4200 --no-open
```

Frontend local:

- Web: `http://127.0.0.1:4200`

## Docker y base de datos

Comandos útiles del backend:

```bash
pnpm --dir apps/backend db:test:up
pnpm --dir apps/backend db:test:down
pnpm --dir apps/backend prisma:generate
pnpm --dir apps/backend prisma:migrate
pnpm --dir apps/backend prisma:studio
```

Si usás PostgreSQL local en vez de Docker, solo asegurate de que `DATABASE_URL` apunte a una base existente y luego corré migraciones.

## Comandos útiles del workspace

### Raíz

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm test:coverage
pnpm test:coverage:backend
pnpm test:coverage:web
```

### Backend

```bash
pnpm --dir apps/backend dev
pnpm --dir apps/backend lint
pnpm --dir apps/backend test
pnpm --dir apps/backend test:db
pnpm --dir apps/backend prisma:generate
pnpm --dir apps/backend prisma:migrate
pnpm --dir apps/backend prisma:studio
```

### Frontend

```bash
pnpm --dir apps/web start
pnpm --dir apps/web test
pnpm --dir apps/web test:coverage
pnpm --dir apps/web exec tsc --project tsconfig.app.json --noEmit
pnpm --dir apps/web exec tsc --project tsconfig.spec.json --noEmit
```

## Troubleshooting rápido

- **`DATABASE_URL` inválida o base inexistente** → Prisma no va a migrar ni arrancar. Verificá host, puerto, credenciales y nombre de base.
- **Docker levantó solo `simulador_api_test`** → creá una base de desarrollo separada o apuntá conscientemente a la de tests si sabés lo que estás haciendo.
- **El frontend no conecta** → revisá que el backend esté corriendo en `http://localhost:3000` o ajustá `apps/web/public/app-config.js` para tu entorno.
- **La funcionalidad de IA falla** → el backend arranca sin `OPENAI_API_KEY`, pero las rutas de IA van a responder como no disponibles si no configurás una key real.
- **No mezcles `npm` con `pnpm`** → el workspace está pensado para pnpm; evitá generar `package-lock.json`.

## Flujo recomendado de trabajo

1. instalar dependencias con `pnpm install`
2. levantar PostgreSQL
3. configurar `apps/backend/.env`
4. correr migraciones del backend
5. levantar backend y frontend
6. validar cambios con lint/tests acotados
7. abrir PR contra `dev`

## Documentación por app

- [Backend (`apps/backend/README.md`)](apps/backend/README.md)
- [Frontend (`apps/web/README.md`)](apps/web/README.md)

## Endpoints principales del backend

- `GET /health`
- `GET/POST/PATCH/DELETE /api/v1/projects`
- `GET/POST/PATCH/DELETE /api/v1/projects/:projectId/endpoints`
- `GET/POST/PATCH/DELETE /api/v1/endpoints/:endpointId/scenarios`
- `GET/PUT /api/v1/endpoints/:endpointId/config`
- `GET/PUT /api/v1/projects/:projectId/config`
- `GET/DELETE /api/v1/projects/:projectId/logs`
- `POST /api/v1/projects/:projectId/endpoints/ai-preview`
- `POST /api/v1/projects/:projectId/endpoints/ai-generate`
- `ANY /mock/:projectSlug/*`

## Notas importantes

- La rama de integración del equipo hoy es **`dev`**.
- La CI valida lint, typecheck, tests y build de producción del frontend, más cobertura/integración del backend con DB.
- Los cambios grandes del repo se vienen trabajando con **SDD (Spec-Driven Development)**.
