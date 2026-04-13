# Deployment readiness checklist

## Purpose

This document defines the minimum runtime configuration, startup prerequisites, and validation steps required to boot `simulador-api-ia` outside ad-hoc local development.

Use it together with:

- `README.md`
- `apps/backend/README.md`
- `apps/web/README.md`
- `docs/runtime-config-audit.md`

---

## 1. Deployment model at a glance

The current product has two runtime surfaces:

1. **Backend** (`apps/backend`)
   - Express API
   - mock runtime
   - Prisma/PostgreSQL access
   - optional AI integration

2. **Frontend** (`apps/web`)
   - Angular SPA
   - runtime configuration via `public/app-config.js`
   - Clerk browser initialization for authenticated management access

The current auth model is intentionally transitional:

- backend management API is protected
- frontend initializes Clerk with `clerkPublishableKey`
- mock runtime remains public in this phase

That means deployment readiness must validate **both runtime config and current auth transport expectations**.

---

## 2. Backend readiness

## Required before boot

### Mandatory

- `DATABASE_URL`

### Required in non-local/shared environments

- `MOCK_BASE_URL`
- `CORS_ALLOWED_ORIGINS`

### Required only if AI-assisted routes must work

- `OPENAI_API_KEY`
- optionally `OPENAI_MODEL`

### Usually explicit even when defaults exist

- `PORT`
- `NODE_ENV`

---

## Backend readiness checklist

- [ ] `DATABASE_URL` points to a reachable PostgreSQL instance
- [ ] Prisma client can be generated successfully
- [ ] migrations can be applied successfully
- [ ] `MOCK_BASE_URL` matches the real public mock base for this environment
- [ ] `CORS_ALLOWED_ORIGINS` includes the browser origins that will call `/api/v1/**`
- [ ] `NODE_ENV` is correct for the environment
- [ ] `OPENAI_API_KEY` is set if AI features are expected to be available

---

## Backend startup validation

Run these checks before considering the backend ready:

```bash
pnpm --dir apps/backend exec prisma generate
pnpm --dir apps/backend exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --dir apps/backend lint
pnpm --dir apps/backend test
```

For DB-backed validation:

```bash
pnpm --dir apps/backend test:db
```

Runtime smoke checks:

- [ ] `GET /health` returns `200`
- [ ] backend starts without env parse failures
- [ ] dashboard/project mock URLs reflect `MOCK_BASE_URL`, not localhost assumptions
- [ ] browser preflight requests from allowed origins receive CORS headers
- [ ] disallowed origins do not receive `Access-Control-Allow-Origin`
- [ ] if `OPENAI_API_KEY` is missing, AI endpoints fail as unavailable instead of crashing boot

---

## Expected backend failure modes

### `DATABASE_URL` missing or invalid

Expected result:

- boot fails fast
- Prisma cannot initialize

### `MOCK_BASE_URL` omitted outside local development

Expected result:

- app may still boot
- but public/mock URLs may be misleading for non-local environments

### `CORS_ALLOWED_ORIGINS` omitted in production

Expected result:

- browser origins are **not** broadly allowed
- management API browser access will fail unless the origin is explicitly allowlisted

### `OPENAI_API_KEY` omitted

Expected result:

- backend still boots
- AI-assisted routes return unavailable behavior

---

## 3. Frontend readiness

## Required runtime config keys

Set through `apps/web/public/app-config.js` or equivalent runtime injection:

- `apiBaseUrl`
- `mockBaseUrl` (or ensure derivation from `apiBaseUrl` is correct for the environment)
- `clerkPublishableKey` for authenticated frontend flows

---

## Frontend readiness checklist

- [ ] runtime host serves `app-config.js`
- [ ] `apiBaseUrl` points to the real backend management API
- [ ] `mockBaseUrl` points to the real public mock runtime base (or derivation is verified)
- [ ] `clerkPublishableKey` is present when authenticated workspace access is expected
- [ ] deployed frontend origin is present in backend `CORS_ALLOWED_ORIGINS`

---

## Frontend startup validation

Validation commands:

```bash
pnpm --dir apps/web test
pnpm --dir apps/web exec tsc --project tsconfig.app.json --noEmit
pnpm --dir apps/web exec tsc --project tsconfig.spec.json --noEmit
```

Runtime smoke checks:

- [ ] app loads without runtime config errors
- [ ] frontend reaches the configured `apiBaseUrl`
- [ ] project `mockUrl` links point to the expected environment base
- [ ] frontend enters authenticated state correctly when Clerk is configured
- [ ] frontend shows a clear misconfigured state if `clerkPublishableKey` is missing
- [ ] unauthenticated/unauthorized states are handled gracefully by the shell

---

## 4. Environment-specific guidance

## Local development

Reasonable local assumptions:

- backend on `http://localhost:3000`
- frontend on `http://127.0.0.1:4200` or `http://localhost:4200`
- `CORS_ALLOWED_ORIGINS` may point at localhost origins
- Docker/Postgres local is acceptable

## Shared / staging / production-like

Must be explicit:

- `DATABASE_URL`
- `MOCK_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- frontend `apiBaseUrl`
- frontend `mockBaseUrl` if derivation is not guaranteed correct
- `clerkPublishableKey`
- `OPENAI_API_KEY` if AI is part of the environment expectations

Do **not** rely on localhost defaults here.

---

## 5. Minimal deployment handoff checklist

Before handing an environment to QA, stakeholders, or users, confirm:

- [ ] backend env file / secrets are defined
- [ ] frontend runtime config is defined
- [ ] DB migrations are applied
- [ ] backend health endpoint works
- [ ] authenticated browser access works from the intended frontend origin
- [ ] project dashboard shows correct public mock URLs
- [ ] AI behavior is either enabled and working or explicitly known to be unavailable
- [ ] no required runtime key still depends on implicit localhost defaults

---

## 6. Known current limitations

- frontend auth currently depends on browser-side Clerk initialization and the current management auth transport model
- mock runtime remains public in this phase by product decision

These are known and accepted for now, but operators should be aware of them.

---

## Evidence / source references

- `apps/backend/src/config/env.ts`
- `apps/backend/src/config/cors.ts`
- `apps/backend/src/server.ts`
- `apps/backend/src/management/ai/service.ts`
- `apps/web/src/app/shared/config/app-runtime-config.ts`
- `apps/web/src/app/shared/auth/auth.config.ts`
- `apps/web/public/app-config.js`
