# Release Notes — MVP Closure

## Overview

`simulador-api-ia` reached a closed MVP state. The product now supports the full core flow for creating, configuring, running, and observing simulated APIs through a real web UI, persistent backend, assisted AI flows, and production-grade validation in CI.

## Included in this MVP

### Project management

- Create projects
- Edit projects
- Delete projects
- List available projects
- Navigate active workspace per project

### Endpoint management

- Create endpoints manually
- Edit existing endpoints
- Delete endpoints
- List endpoints by project
- Configure endpoint behavior
- Manage endpoint scenarios

### Mock runtime

- Real mock runtime exposed through `/mock/:projectSlug/*`
- Dynamic response resolution by project and path
- Simulated latency
- Simulated error responses
- Simulated timeouts
- Weighted scenario behavior
- Request logging
- Runtime rate limiting

### Global configuration

- Global latency configuration
- Global error simulation
- Global rate limiting
- Logging level selection
- Honest UI for unsupported advanced controls using disabled `Próximamente` states

### Dashboard and observability

- Real backend-driven dashboard summary
- Project metrics and health indicators
- Recent requests overview
- Real log listing and inspection in the UI
- Removal of dashboard endpoint fan-out (no more N+1 loading pattern)

### AI-assisted flows

- `ai-preview`: generates a draft endpoint without persisting it
- `ai-generate`: creates and persists the first endpoint of a project
- Lazy OpenAI bootstrap: backend no longer requires `OPENAI_API_KEY` at startup
- Typed AI error handling:
  - `AI_UNAVAILABLE`
  - `AI_TIMEOUT`
  - `AI_INVALID_OUTPUT`

### Frontend runtime configuration

- Frontend no longer depends on hardcoded localhost URLs
- Runtime configuration now comes from `apps/web/public/app-config.js`
- Supports runtime override of:
  - `apiBaseUrl`
  - `mockBaseUrl`

### Quality and CI

- Backend lint and coverage validation
- Backend DB integration checks
- Frontend lint
- Frontend app/spec typecheck
- Frontend headless tests
- Frontend production build validation in CI
- PR validation for issue linkage, approval labels, and PR type labels

## Technical highlights delivered

- Real runtime rate limiting is now enforced project-wide
- Advanced unsupported knobs are aligned with real MVP behavior instead of misleading users
- AI flow documentation and UX copy now match the implemented product behavior
- Frontend production build is part of the CI gate
- Historical SDD docs were corrected where they had stale factual claims

## Known MVP boundaries

- Rate limiting is currently enforced **project-wide**
- Some advanced controls remain visible but disabled as `Próximamente`
- Frontend runtime depends on hosting publishing `app-config.js`
- Some heavy component styles were moved to a global stylesheet to satisfy Angular production build budgets

## Out of scope for this MVP

- Advanced per-endpoint semantics for all global controls
- Full support for all currently disabled advanced knobs
- Advanced operational metrics such as p95/error ratio aggregation
- Contract testing / automated OpenAPI validation
- Post-MVP hardening and scalability work

## Final status

This MVP is considered **closed** at the current repository state.

It now includes:

- usable product flows
- real runtime behavior
- real AI-assisted creation flows
- real observability basics
- production build validation
- aligned documentation and CI
