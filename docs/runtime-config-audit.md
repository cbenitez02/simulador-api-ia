# Runtime configuration audit

## Purpose

This document audits the current backend/frontend runtime configuration contract for `simulador-api-ia`.

It exists to support issue #38 and to make the next hardening tasks (#39, #40, #41) explicit instead of guess-based.

---

## Executive summary

The project currently has **two configuration surfaces**:

1. **Backend env variables** loaded from `apps/backend/.env`
2. **Frontend runtime config** loaded from `apps/web/public/app-config.js` through `window.__SIMULADOR_RUNTIME_CONFIG__`

The contract is already usable for local development, but it still carries **MVP-era local assumptions**:

- backend defaults to `http://localhost:3000/mock`
- frontend defaults to `http://localhost:3000/api/v1` and derives `http://localhost:3000/mock`
- backend startup log still prints `http://localhost:<port>` even when the public deployment URL differs
- auth requires a frontend `clerkPublishableKey`, but the deployment contract is only partially documented

This means the current configuration model is **functional for local/dev and controlled environments**, but still needs hardening before broader production rollout.

---

## Configuration surfaces

## 1. Backend environment variables

Source of truth in code:

- `apps/backend/src/config/env.ts`
- `apps/backend/src/lib/prisma.ts`
- `apps/backend/src/server.ts`
- `apps/backend/src/management/ai/service.ts`

### Current backend contract

| Variable         |    Required | Default                      | Used for                              | Notes                                                                |
| ---------------- | ----------: | ---------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`   |         Yes | none                         | Prisma/PostgreSQL connection          | Hard required by env parsing and Prisma bootstrap                    |
| `OPENAI_API_KEY` | No for boot | none                         | AI-assisted backend routes            | Backend starts without it; AI routes return unavailable when missing |
| `OPENAI_MODEL`   |          No | `gpt-4.1-mini`               | AI model selection                    | Reasonable default for dev, should still be explicit per environment |
| `MOCK_BASE_URL`  |          No | `http://localhost:3000/mock` | Public mock URL generation in backend | Safe for local, unsafe as implicit deploy default                    |
| `PORT`           |          No | `3000`                       | HTTP listen port                      | Server log still assumes localhost in the message                    |
| `NODE_ENV`       |          No | `development`                | Environment mode                      | Standard enum: `development`, `test`, `production`                   |

### Backend observations

- `DATABASE_URL` is the only truly mandatory variable today.
- AI is intentionally **lazy-configured**: missing `OPENAI_API_KEY` does not block backend startup.
- `MOCK_BASE_URL` is the most important **non-local risk** because it influences URLs surfaced to users.
- `server.ts` now logs the listen port only, avoiding any implication that localhost is the public deployment origin.

---

## 2. Frontend runtime config

Source of truth in code:

- `apps/web/src/app/shared/config/app-runtime-config.ts`
- `apps/web/src/app/shared/config/api.config.ts`
- `apps/web/src/app/shared/auth/auth.config.ts`
- `apps/web/public/app-config.js`

### Current frontend contract

| Runtime key           |                                Required | Default                                                           | Used for                             | Notes                                                            |
| --------------------- | --------------------------------------: | ----------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `apiBaseUrl`          |                                      No | `http://localhost:3000/api/v1`                                    | Angular management API base URL      | Local-safe, deploy-unsafe if forgotten                           |
| `mockBaseUrl`         |                                      No | derived from `apiBaseUrl`, otherwise `http://localhost:3000/mock` | UI mock URL display/fallback mapping | Better than hardcoding, but still localhost by default           |
| `clerkPublishableKey` | Required for auth-enabled frontend flow | none                                                              | Clerk browser SDK initialization     | Missing key puts frontend auth boundary in `misconfigured` state |

### Frontend observations

- The frontend is configured at runtime through `app-config.js`, which is good because it avoids rebuilds for environment changes.
- `mockBaseUrl` derivation from `apiBaseUrl` is a solid pattern, but if `apiBaseUrl` is left on localhost in a deployed environment, the UI will surface invalid mock URLs.
- `clerkPublishableKey` is now part of the real frontend contract for authenticated workspace access.
- The frontend auth boundary handles missing Clerk config gracefully, but deployment docs still need a stronger checklist for this setup.

---

## Hidden local assumptions

These are the main assumptions that are convenient in local development but dangerous if left implicit in deployment.

### Assumption 1 — localhost as public backend/mock origin

Current defaults assume:

- backend mock runtime is at `http://localhost:3000/mock`
- frontend management API is at `http://localhost:3000/api/v1`

This is acceptable for local bootstrapping, but **unsafe as an unnoticed deploy fallback**.

### Assumption 2 — backend startup log implies real public origin

`apps/backend/src/server.ts` prints:

```text
Backend running on http://localhost:<port>
```

That is only true for local direct execution. Behind a reverse proxy, container platform, ingress, or custom hostname, it is only a local bind address, not a public URL.

### Assumption 3 — auth can be enabled by frontend-only runtime config

Today the frontend can initialize Clerk using only `clerkPublishableKey`. That is enough for the current browser/header-based boundary, but it is **not the final hardened transport model**.

This is fine for the current phase, but should be documented as an interim state, not a final production posture.

### Assumption 4 — test configuration names are slightly ahead of the runtime contract

Docs mention `DATABASE_URL_TEST` as an override path for DB testing, but the runtime env schema itself only models `DATABASE_URL`.

That does not break current CI, but it is a sign that documentation and runtime contract are not yet perfectly aligned.

---

## Classification by deployment sensitivity

## Safe local defaults

These are acceptable defaults for local development only:

- backend `PORT=3000`
- backend `NODE_ENV=development`
- frontend `apiBaseUrl=http://localhost:3000/api/v1`
- frontend derived/mock localhost URLs

## Must be explicit outside local development

These should be explicitly configured in any shared/staging/production-like environment:

- `DATABASE_URL`
- `MOCK_BASE_URL`
- frontend `apiBaseUrl`
- frontend `mockBaseUrl` if derivation is not trusted for that environment
- `clerkPublishableKey`
- `OPENAI_API_KEY` if AI-assisted routes are expected to work
- `OPENAI_MODEL` if environment-specific model/cost policy matters

## Sensitive / operationally important

These require extra care because they affect security, public URLs, or cost:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `MOCK_BASE_URL`
- `clerkPublishableKey` (public but operationally important)

---

## What is already good

- Backend env parsing is centralized through Zod.
- Frontend runtime config is centralized and override-friendly.
- AI config is lazy instead of crashing boot.
- Frontend auth boundary degrades gracefully when Clerk is missing.
- `mockBaseUrl` can be derived from `apiBaseUrl`, reducing duplication.

---

## What remains weak

- localhost defaults are still too easy to accidentally carry into deployment.
- public/backend URL concepts are not fully separated in docs and startup messaging.
- auth-related deployment requirements are spread across README text and UI fallback copy instead of a single readiness checklist.
- docs mention at least one test override (`DATABASE_URL_TEST`) that is not reflected in the main runtime schema.

---

## Recommended follow-up work

### For #39 — public URL hardening

- remove remaining localhost assumptions from surfaced/public URLs
- make backend public URL generation explicit per environment
- revisit startup logging so it does not imply a fake public origin

### For #40 — CORS and HTTP exposure hardening

- document per-environment origin policy
- separate local development defaults from production-safe defaults
- define how authenticated browser calls are expected to work with credentials/origin restrictions

### For #41 — deployment readiness documentation

- create a single checklist for backend + frontend runtime config
- document minimum required values for local, staging, and production-like environments
- explicitly call out current interim auth transport assumptions

---

## Acceptance criteria mapping for issue #38

| Issue requirement                                                              | Covered here |
| ------------------------------------------------------------------------------ | ------------ |
| runtime variables are inventoried and classified                               | Yes          |
| unsafe defaults are identified                                                 | Yes          |
| local-only assumptions are explicitly listed                                   | Yes          |
| environment contract is documented clearly enough for implementation follow-up | Yes          |

---

## Evidence

- `apps/backend/src/config/env.ts` — backend env schema and defaults
- `apps/backend/src/lib/prisma.ts` — hard dependency on `DATABASE_URL`
- `apps/backend/src/server.ts` — startup logging now distinguishes listen port from public URL config
- `apps/backend/src/management/ai/service.ts` — lazy `OPENAI_API_KEY` usage
- `apps/backend/README.md` — backend env docs and current onboarding guidance
- `apps/web/src/app/shared/config/app-runtime-config.ts` — frontend runtime config contract and localhost defaults
- `apps/web/src/app/shared/auth/auth.config.ts` — runtime Clerk config injection
- `apps/web/public/app-config.js` — deploy-time config surface
- `apps/web/README.md` — frontend runtime config documentation
- `README.md` — repo-level environment overview
