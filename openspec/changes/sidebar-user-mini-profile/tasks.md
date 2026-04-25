# Tasks: Sidebar User Mini Profile

## Phase 1: SDD and auth contract

- [x] 1.1 Create change artifacts (`proposal.md`, `design.md`, `tasks.md`) and delta spec for sidebar identity behavior.
- [x] 1.2 RED/GREEN: extend `apps/web/src/app/shared/auth/models/frontend-auth.model.ts` and `apps/web/src/app/shared/auth/clerk-frontend-auth.adapter.ts` to include optional `avatarUrl`; update adapter/auth fixtures.

## Phase 2: Sidebar user section

- [x] 2.1 RED: extend `apps/web/src/app/features/main-dashboard/components/main-dashboard-sidebar/main-dashboard-sidebar.component.spec.ts` to cover user section with avatar and initials fallback.
- [x] 2.2 GREEN: modify sidebar component TS/HTML/CSS to render compact user identity section between active project card and sign out.
- [x] 2.3 GREEN: update `apps/web/src/app/features/workspace-shell/workspace-shell.component.html` bindings to pass authenticated display name/avatar into the sidebar.

## Phase 3: Verify

- [x] 3.1 VERIFY: run targeted web tests for `shared/auth` and `main-dashboard-sidebar`.
- [x] 3.2 VERIFY: run lint diagnostics for touched files and resolve introduced issues.
