# Tasks: Manual Endpoint Creation

## Phase 1: Contracts and test seams

- [x] 1.1 RED: extend `apps/web/src/app/shared/models/endpoint-preview.model.ts`, `apps/web/src/app/shared/http/api.types.ts`, and `apps/web/src/app/shared/constants/http-method-select-options.ts` to include `HEAD` and `OPTIONS`; add/update `apps/web/src/app/features/endpoints/adapters/endpoint-api.mapper.spec.ts` for method and lock defaults.
- [x] 1.2 GREEN: update `apps/web/src/app/features/endpoints/models/endpoint-draft.model.ts` and `apps/web/src/app/features/endpoints/adapters/endpoint-api.mapper.ts` with `EndpointFlowMode`, shared lock helpers, and manual/edit draft defaults.
- [x] 1.3 RED/GREEN: extend `apps/web/src/app/features/endpoints/data-access/endpoints.repository.spec.ts` and `apps/web/src/app/features/endpoints/data-access/endpoints.repository.ts` to return stage-aware partial-save errors/results with persisted endpoint id.

## Phase 2: Wizard flow

- [x] 2.1 RED: expand `apps/web/src/app/features/endpoints/components/create-endpoint-page/create-endpoint-page.component.spec.ts` and `create-endpoint-page.integration.spec.ts` for `ai|manual|edit` bootstrap, shared draft convergence, partial-save messaging, and edit limitation UX.
- [x] 2.2 GREEN: modify `apps/web/src/app/features/endpoints/components/create-endpoint-page/create-endpoint-page.component.ts/html` to accept explicit mode, seed manual drafts from method/path, reuse the shared editor/save pipeline, and surface stage-aware recovery states.
- [x] 2.3 RED/GREEN: update `apps/web/src/app/features/endpoints/components/create-endpoint-review-step/create-endpoint-review-step.component.ts/html` so the step serves manual basics entry and AI review, with mode-aware labels/help/locks and aligned method options.
- [x] 2.4 RED/GREEN: cover and implement `apps/web/src/app/features/endpoints/components/create-endpoint-editor-step/create-endpoint-editor-step.component.ts/html` read-only method/path behavior in edit mode plus explicit non-persistence copy.

## Phase 3: Caller wiring and recovery

- [x] 3.1 RED: add `apps/web/src/app/features/workspace-shell/workspace-shell.component.spec.ts` cases for create/edit/manual launch modes and partial-success continuation into manual setup.
- [x] 3.2 GREEN: modify `apps/web/src/app/features/workspace-shell/workspace-shell.component.ts` to pass `mode: 'ai' | 'manual' | 'edit'`, keep plan gating outside the wizard, and route recovery into manual mode.
- [x] 3.3 RED/GREEN: update `apps/web/src/app/shared/ui/create-project-modal/create-project-modal.component.spec.ts` and `create-project-modal.component.ts/html` so partial-success copy confirms project creation, offers “continue manually”, and avoids AI-retry wording.

## Phase 4: Contract guards and verification

- [x] 4.1 RED/GREEN: add/update backend guards in `apps/backend/src/__tests__/app.integration.test.ts` and `apps/backend/src/management/endpoints/schema.ts` to verify create supports `HEAD|OPTIONS` while `updateEndpointSchema` still excludes `method/path`.
- [x] 4.2 REFACTOR: normalize shared copy/status helpers across `create-endpoint-page`, review/editor steps, and `create-project-modal`; keep compatibility behavior intact and remove duplicated mode checks.
- [x] 4.3 VERIFY: run targeted web/backend Vitest suites for the touched files and confirm every scenario in `openspec/changes/manual-endpoint-creation/specs/endpoint-creation-flow/spec.md` and `specs/project-creation-recovery/spec.md` is covered.
