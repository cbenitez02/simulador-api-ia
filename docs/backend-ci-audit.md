# Backend CI audit

## Purpose

This document audits the current backend CI coverage for `simulador-api-ia` and identifies which guarantees are already enforced versus which build/type-safety checks are still missing.

It exists to satisfy issue #42 and to provide the factual basis for follow-up issue #43.

---

## Executive summary

The backend CI is already in a **good intermediate state**, not a weak one.

Today the repository enforces:

- backend lint
- backend Prisma schema validation
- backend unit/integration coverage
- backend DB integration against real PostgreSQL

But one important gap still remains:

- there is **no explicit backend build/type-safety gate** in CI, even though the backend package defines `build: tsc`

So the current CI is strong on **behavioral validation**, but still incomplete on **compile-time guarantees**.

---

## Current backend CI coverage

Source of truth:

- `.github/workflows/ci.yml`
- `apps/backend/package.json`

### Currently enforced in CI

#### 1. Prisma schema validation

Workflow step:

- `pnpm --dir apps/backend exec prisma validate --schema prisma/schema.prisma`

Guarantee:

- schema shape is valid before merge

#### 2. Lint

Workflow step:

- `pnpm --dir apps/backend lint`

Guarantee:

- backend source passes ESLint rules

#### 3. Unit + integration coverage

Workflow step:

- `pnpm --dir apps/backend test:coverage`

Guarantee:

- behavior-level tests run in CI
- coverage artifacts are produced

#### 4. DB integration with real PostgreSQL

Workflow job:

- `Backend DB Integration`

Steps include:

- Prisma generate
- Prisma migrate deploy
- DB-backed Vitest run on `src/__tests__/db.integration.test.ts`

Guarantee:

- backend survives real schema generation and migration flow
- DB-backed runtime behaviors are validated against PostgreSQL

---

## What CI does NOT currently guarantee

### 1. Explicit backend TypeScript build success

The backend package defines:

```json
"build": "tsc"
```

But the CI workflow does **not** run:

```bash
pnpm --dir apps/backend build
```

That means CI can still go green while the backend has:

- TypeScript compile errors only visible at build time
- declaration/import issues not exercised by current test paths
- production packaging drift that tests do not catch

This is the most important gap.

### 2. Explicit standalone backend typecheck policy

The frontend has explicit typecheck gates in CI (`typecheck:web:app`, `typecheck:web:spec`).

The backend has no equivalent named check today. The practical substitute should be either:

- `pnpm --dir apps/backend build`
  or
- a dedicated no-emit typecheck script

Right now, type-safety is only partially covered indirectly through tests/build-adjacent tooling.

### 3. Explicit release gate documentation for backend changes

The workflow enforces useful steps, but the repo still lacks a concise backend-specific statement of:

- which failures block merge
- what minimum backend validation is expected by change type
- what release-readiness means for backend-affecting work

This is more of a workflow/documentation gap than a pure CI gap, and maps to issue #44.

---

## Comparison: current guarantees vs intended guarantees

| Area                              | Current state          | Assessment |
| --------------------------------- | ---------------------- | ---------- |
| Prisma schema validity            | Covered                | Good       |
| Lint                              | Covered                | Good       |
| Unit/integration behavior         | Covered                | Good       |
| Real DB integration               | Covered                | Strong     |
| Backend build success             | Not explicitly covered | Gap        |
| Backend type-safety as named gate | Not explicitly covered | Gap        |
| Release gate documentation        | Partial / implied      | Gap        |

---

## Minimal stronger target state

The smallest meaningful improvement for the next step (#43) is:

1. keep existing backend CI jobs
2. add an explicit backend build/type-safety gate

Recommended minimal addition:

```bash
pnpm --dir apps/backend build
```

Why this is the right next move:

- it uses an already defined script
- it validates real TypeScript compilation
- it is simpler than inventing a new backend typecheck convention first
- it closes the biggest backend CI blind spot immediately

Optional later improvement:

- add a dedicated backend typecheck script if the team wants parity with frontend naming

---

## Recommended follow-up mapping

### Issue #43

Should implement:

- explicit backend build/type-safety gate in CI
- any small workflow adjustments needed to make that gate reliable

### Issue #44

Should document:

- merge gates
- release-readiness expectations
- contributor/backend delivery expectations

---

## Acceptance criteria mapping for issue #42

| Issue requirement                                  | Covered here |
| -------------------------------------------------- | ------------ |
| backend CI coverage gaps are explicitly identified | Yes          |
| missing gates are listed with rationale            | Yes          |
| a minimal stronger target state is defined         | Yes          |

---

## Evidence

- `.github/workflows/ci.yml` — current backend CI jobs and steps
- `apps/backend/package.json` — backend `build` script exists but is not used in CI
