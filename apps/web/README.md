# Frontend Web

Aplicación Angular 21 del simulador. Es la UI principal para gestionar proyectos, operar el workspace y consumir el backend real.

## Stack

- Angular 21
- Angular Material / CDK
- Vitest
- TypeScript

## Qué cubre hoy

- dashboard principal de proyectos
- workspace del proyecto activo
- gestión de endpoints manuales
- edición y eliminación de proyectos
- configuración global
- visualización de logs
- settings

## Estructura principal

```text
apps/web/src/app/
├── features/
│   ├── endpoints/
│   ├── global-config/
│   ├── logs/
│   ├── main-dashboard/
│   ├── settings/
│   └── workspace-shell/
├── shared/
│   ├── config/
│   ├── http/
│   ├── ui/
│   └── utils/
└── testing/
```

## Levantar en local

Desde la raíz del monorepo:

```bash
pnpm --dir apps/web exec ng serve --host 127.0.0.1 --port 4200 --no-open
```

Abrí:

```text
http://127.0.0.1:4200
```

## Dependencia con backend

La app espera backend disponible en `http://localhost:3000`.

Además, hoy deriva la mock URL desde esa base local. Si cambiás host o puerto, revisá `src/app/shared/config/api.config.ts`.

## Scripts útiles

```bash
pnpm --dir apps/web start
pnpm --dir apps/web build
pnpm --dir apps/web test
pnpm --dir apps/web exec tsc --project tsconfig.app.json --noEmit
pnpm --dir apps/web exec tsc --project tsconfig.spec.json --noEmit
```

## Testing

El proyecto usa `ng test` con Vitest como runner.

Checks útiles:

```bash
pnpm exec eslint "apps/web/src/**/*.{ts,html}"
pnpm --dir apps/web exec tsc --project tsconfig.app.json --noEmit
pnpm --dir apps/web exec tsc --project tsconfig.spec.json --noEmit
pnpm --dir apps/web test --watch=false
```

## CI

El workflow `CI` del repo corre un job dedicado **Frontend Validation** con:

- lint
- typecheck de app
- typecheck de specs
- tests headless

## Convenciones relevantes

- el frontend consume backend real mediante la capa `shared/http/`
- `workspace-shell` coordina gran parte del estado de selección y navegación
- el modal de proyecto se reutiliza tanto para crear como para editar
- el harness `src/app/testing/angular-vitest.ts` es solo para tests; no forma parte del runtime de la app

## Dónde tocar según el caso

- **HTTP/config**: `src/app/shared/http/`, `src/app/shared/config/`
- **workspace**: `src/app/features/workspace-shell/`
- **proyectos/dashboard**: `src/app/features/main-dashboard/`
- **endpoints**: `src/app/features/endpoints/`
- **UI reusable**: `src/app/shared/ui/`

## Limitaciones actuales

- no hay build de producción dentro del gate inicial de CI
- la URL del backend sigue acoplada a localhost en desarrollo
- el flujo de IA todavía tiene deuda de alineación con backend real
