# Backend merge gates and release readiness

## Purpose

This document defines the minimum delivery discipline for backend-affecting changes in `simulador-api-ia`.

It complements:

- `docs/backend-ci-audit.md`
- `docs/deployment-readiness.md`
- `.github/workflows/ci.yml`

---

## 1. Merge-blocking backend validations

For backend-affecting work, the following CI checks are considered merge-blocking:

### Backend CI gates

- `Prisma validate`
- `Backend lint`
- `Backend build`
- `Unit + integration coverage`
- `Backend DB Integration`

### Cross-repo gates that still matter

- PR validation rules
- Shellcheck (when shell scripts are affected)

---

## 2. What each backend gate guarantees

| Gate                          | What it protects                                 |
| ----------------------------- | ------------------------------------------------ |
| `Prisma validate`             | schema integrity before merge                    |
| `Backend lint`                | code quality / static rule conformance           |
| `Backend build`               | TypeScript compile-time/build safety             |
| `Unit + integration coverage` | behavior-level regression protection             |
| `Backend DB Integration`      | real migration/generate/DB-backed runtime safety |

The important point is this: **passing tests is not enough**. The backend must also compile cleanly and survive real Prisma/DB flow.

---

## 3. Minimum expectations by change type

## A. Docs-only backend-adjacent changes

Expected:

- docs are accurate
- any referenced commands or workflows still match reality

Usually enough:

- no backend runtime validation required if code was not touched

## B. Backend code changes without schema changes

Expected:

- lint passes
- backend build passes
- relevant tests pass

If the change touches routing, auth, request handling, runtime behavior, or persistence logic, treat DB-backed validation as strongly recommended.

## C. Prisma/schema/migration changes

Expected:

- `Prisma validate` passes
- backend build passes
- relevant tests pass
- DB integration path is considered mandatory

This category should not be merged on lint/tests alone.

## D. Auth/config/runtime boundary changes

Expected:

- backend build passes
- app/integration coverage exists for the changed behavior
- DB validation is required if persistence/migrations are affected
- docs are updated when runtime config or operational behavior changes

---

## 4. Backend release-readiness checklist

Before considering a backend-affecting batch ready for release or merge to the integration branch, confirm:

- [ ] CI backend gates are green
- [ ] TypeScript build passes locally or in CI
- [ ] Prisma schema and migrations are valid for the target environment
- [ ] runtime config changes are documented
- [ ] public/mock URL behavior is correct for the target environment
- [ ] auth/CORS changes have at least one integration-level validation path
- [ ] DB-backed behavior is validated when persistence was touched
- [ ] AI behavior is either intentionally configured or intentionally unavailable

---

## 5. Contributor guidance

When touching backend code:

1. run the smallest relevant local validation first
2. do not rely only on unit tests if build, config, or DB behavior changed
3. update docs when runtime behavior or operational expectations change
4. treat `build` failures as real regressions, not optional cleanup

---

## 6. Current practical baseline

As of now, the backend delivery baseline is:

- schema validation
- lint
- backend TypeScript build
- coverage-backed test run
- DB integration run with real PostgreSQL

That is the minimum bar for backend confidence in this repository.

---

## Evidence

- `.github/workflows/ci.yml`
- `docs/backend-ci-audit.md`
- `docs/deployment-readiness.md`
