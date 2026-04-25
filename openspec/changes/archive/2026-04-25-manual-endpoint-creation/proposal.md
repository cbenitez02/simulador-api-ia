# Proposal: Manual Endpoint Creation

## Intent

Enable manual endpoint creation without forking the wizard: one mode-aware flow, shared editor/save pipeline, clearer recovery for partial saves, and no new backend contract.

## Scope

### In Scope

- Add `ai | manual | edit` flow entry with caller-level mode selection.
- Align frontend HTTP method options with backend-supported methods.
- Make shared copy/lock semantics mode-aware instead of AI-centric.
- Improve partial-save handling visibility/recovery in the current multi-call save flow, without redesigning persistence.
- Update partial-success project creation so “continue manually” opens the unified manual flow.

### Out of Scope

- New backend draft APIs, transactional save redesign, or broad entitlement redesign.
- Guaranteeing an edit-mode fix for method/path persistence; design/apply may include it only if it shares the same seam safely.
- Backfilling missing baseline `openspec/specs/*` main specs during this change.

## Capabilities

### New Capabilities

- `endpoint-creation-flow`: Unified create/edit flow with mode-aware entry, shared UX, and method support alignment.
- `project-creation-recovery`: Partial-success project creation continues into manual endpoint setup with recovery messaging.

### Modified Capabilities

- None.

## Approach

Refactor `CreateEndpointPageComponent` around draft acquisition, not AI-first sequencing. Manual mode starts on reused basics (method/path), AI keeps prompt → review → editor, and edit remains compatible. Recovery and save states surface limitations clearly; design will evaluate whether edit-mode method/path persistence can ride the same seam safely.

## Affected Areas

| Area                                         | Impact   | Description                                                  |
| -------------------------------------------- | -------- | ------------------------------------------------------------ |
| `apps/web/.../create-endpoint-page/*`        | Modified | Mode-aware orchestration, save/recovery visibility           |
| `apps/web/.../create-endpoint-review-step/*` | Modified | Manual basics entry, mode-aware copy/locks, method alignment |
| `apps/web/.../workspace-shell.component.ts`  | Modified | Launch mode from caller level                                |
| `apps/web/.../create-project-modal/*`        | Modified | Partial-success manual continuation                          |

## Risks

| Risk                                         | Likelihood | Mitigation                                                                         |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| Partial-save flow still spans multiple calls | High       | Add explicit failure/recovery states, preserve visibility, and spec targeted tests |
| Edit-mode persistence seam may differ        | Med        | Treat as design-time evaluation, not committed scope                               |
| Shared UX regresses AI copy/locks            | Med        | Make mode-aware text/locking part of acceptance/spec coverage                      |

## Rollback Plan

Revert frontend mode-launch wiring and wizard bootstrap to AI-first behavior. Backend contracts stay unchanged, so rollback is limited to web flow and recovery UI.

## Dependencies

- Existing endpoint create/save APIs stay unchanged.
- Callers remain responsible for entitlement gating.

## Success Criteria

- [ ] Manual users can create endpoints through the existing wizard shell without invoking AI.
- [ ] Frontend method choices match backend-supported methods in the unified flow.
- [ ] Shared steps show mode-aware copy/lock behavior for manual, AI, and recovery paths.
- [ ] Partial-success and partial-save states provide clearer recovery/visibility without a persistence redesign.
