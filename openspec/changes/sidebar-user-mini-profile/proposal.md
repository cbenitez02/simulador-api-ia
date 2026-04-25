# Proposal: Sidebar User Mini Profile

## Intent

Add a compact identity block in the workspace sidebar so authenticated users can quickly confirm who is signed in without leaving the current project context.

## Scope

### In Scope

- Add a mini section between the active project card and the `Sign out` action.
- Show the authenticated user name and Clerk avatar image.
- Extend frontend auth snapshot mapping with optional avatar URL.
- Add/adjust tests for auth mapping and sidebar rendering fallbacks.

### Out of Scope

- Editing user profile data from the sidebar.
- Fetching workspace role for this section.
- Backend API contract changes.

## Capabilities

### New Capabilities

- `sidebar-user-identity`: Render authenticated user identity (avatar + name) in the main workspace sidebar.

### Modified Capabilities

- None.

## Approach

Reuse existing auth session flow (`FrontendAuthSessionService`) by extending `FrontendAuthSnapshot` with an optional `avatarUrl` from Clerk. Pass auth identity fields from `WorkspaceShellComponent` into `MainDashboardSidebarComponent`, where the new mini profile section renders with image-first UI and initials fallback.

## Affected Areas

| Area                                                                           | Impact   | Description                                                          |
| ------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------- |
| `apps/web/src/app/shared/auth/*`                                               | Modified | Include `avatarUrl` in auth snapshot model and Clerk adapter mapping |
| `apps/web/src/app/features/workspace-shell/*`                                  | Modified | Pass authenticated identity into sidebar inputs                      |
| `apps/web/src/app/features/main-dashboard/components/main-dashboard-sidebar/*` | Modified | Add mini profile UI, styling, and render guards                      |
| `openspec/changes/sidebar-user-mini-profile/*`                                 | New      | Proposal/design/tasks/spec delta                                     |

## Risks

| Risk                                | Likelihood | Mitigation                             |
| ----------------------------------- | ---------- | -------------------------------------- |
| Missing avatar for some Clerk users | Med        | Render deterministic initials fallback |
| Sidebar clutter on small heights    | Low        | Keep section compact and token-aligned |

## Rollback Plan

Revert sidebar identity inputs/markup/styles and remove `avatarUrl` from snapshot mapping. No persistence or backend migration is needed.

## Dependencies

- Existing Clerk session object exposing `imageUrl`.
- Existing workspace-shell to sidebar binding path.

## Success Criteria

- [ ] Sidebar shows avatar + signed-in user name between active project card and `Sign out`.
- [ ] Sidebar uses fallback initials when avatar URL is missing or broken.
- [ ] Existing sign-out behavior remains unchanged.
- [ ] Auth adapter and sidebar tests pass with the new identity block.
