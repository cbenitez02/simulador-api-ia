# Design: Manual Endpoint Creation

## Technical Approach

Refactor the endpoint wizard around a flow mode, not an AI-first sequence. `CreateEndpointPageComponent` will accept `mode: 'ai' | 'manual' | 'edit'` and derive its initial step from that mode: `ai -> prompt`, `manual -> review`, `edit -> editor`. All modes will converge into the existing `EndpointDraft` editor and `EndpointsRepository.saveEndpoint()` pipeline. No transactional backend redesign is introduced; instead, save failures become stage-aware so the UI can explain partial persistence and recovery.

## Architecture Decisions

| Decision                     | Options                                                        | Choice                                                         | Rationale                                                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wizard entry model           | Keep `isEditing`; add scattered flags; add explicit mode       | Explicit `EndpointFlowMode`                                    | One state source for caller entry, copy, locks, and step routing without forking components.                                                                                                                                                                                          |
| Manual step reuse            | New manual-only step; reuse review step                        | Reuse review step as method/path entry + AI review             | Preserves existing shell/layout and keeps one normalization seam for method/path.                                                                                                                                                                                                     |
| Edit method/path persistence | Extend PATCH contract now; keep current backend contract       | Exclude persistence now; make limitation explicit in edit mode | Backend `updateEndpointSchema` and DTOs do not support `method/path` today. Expanding them changes compatibility-sensitive contracts and duplicate validation behavior, which is outside approved scope. Safe path is to lock or read-only those fields in edit mode and explain why. |
| Partial-save mitigation      | Ignore stages; redesign persistence; expose stage-aware errors | Stage-aware frontend recovery                                  | Works with current multi-call flow while making created/updated core endpoint visibility explicit.                                                                                                                                                                                    |

## Data Flow

```text
Caller (workspace shell / project recovery)
  -> CreateEndpointPage(mode, projectId, initialEndpoint?)
     -> initial step: prompt | review | editor
     -> draft acquisition:
        ai: preview API -> draft
        manual: seeded draft from method/path defaults
        edit: load detail API -> draft
     -> shared editor
     -> saveEndpoint()
        -> POST or PATCH endpoint core
        -> PUT config
        -> reconcile scenarios
        -> GET detail on success
        -> throw stage-aware partial error on failure
```

## File Changes

| File                                                                                                    | Action | Description                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/features/endpoints/components/create-endpoint-page/create-endpoint-page.component.ts` | Modify | Add `mode` input, initial-step bootstrap, mode-aware subtitle/title/copy, seeded manual draft creation, partial-save state handling. |
| `.../create-endpoint-page.component.html`                                                               | Modify | Render mode-aware buttons/alerts and edit limitation copy.                                                                           |
| `.../create-endpoint-review-step.component.ts/html`                                                     | Modify | Reuse as manual entry + AI review; accept mode-aware labels/badges/help text.                                                        |
| `.../create-endpoint-editor-step.component.ts/html`                                                     | Modify | Show mode-aware metadata text; lock/read-only method/path in edit mode.                                                              |
| `apps/web/src/app/features/endpoints/models/endpoint-draft.model.ts`                                    | Modify | Add `EndpointFlowMode`, optional save-status metadata, and lock semantics helpers.                                                   |
| `apps/web/src/app/features/endpoints/data-access/endpoints.repository.ts`                               | Modify | Emit structured `EndpointSaveError`/result with failing stage and persisted endpoint id when partial save occurs.                    |
| `apps/web/src/app/features/endpoints/adapters/endpoint-api.mapper.ts`                                   | Modify | Align method unions with backend (`HEAD`, `OPTIONS`), add manual/edit lock defaults.                                                 |
| `apps/web/src/app/shared/constants/http-method-select-options.ts`                                       | Modify | Add `HEAD` and `OPTIONS`.                                                                                                            |
| `apps/web/src/app/shared/models/endpoint-preview.model.ts` and `shared/http/api.types.ts`               | Modify | Extend frontend HTTP method unions and flow DTO typing.                                                                              |
| `apps/web/src/app/features/workspace-shell/workspace-shell.component.ts/html`                           | Modify | Pass explicit wizard mode from create/edit/recovery callers; partial-success “continue manually” opens manual mode.                  |
| `apps/web/src/app/shared/ui/create-project-modal/create-project-modal.component.ts/html`                | Modify | Recovery copy/action points to manual setup, not AI retry.                                                                           |

## Interfaces / Contracts

```ts
type EndpointFlowMode = 'ai' | 'manual' | 'edit';

type SaveStage = 'endpoint-core' | 'config' | 'scenarios' | 'refresh';

interface EndpointSaveError extends Error {
  stage: SaveStage;
  endpointId: string | null;
  partial: boolean;
}
```

Frontend method unions will match backend-supported values exactly: `GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS`.

## Testing Strategy

| Layer                                | What to Test                                                                                                  | Approach                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unit                                 | Mode-to-step bootstrap, edit lock rules, method option alignment, save-stage error mapping                    | Vitest component/service tests                                                                           |
| Integration                          | AI path, manual path, edit hydration, partial-save recovery messaging, project partial-success -> manual flow | Existing Angular integration specs for `create-endpoint-page`, `workspace-shell`, `create-project-modal` |
| Integration (backend contract guard) | Supported methods remain `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS`; PATCH still excludes method/path           | Vitest + Supertest schema/router tests                                                                   |

## Migration / Rollout

No data migration required. Roll out behind existing caller gating only: callers decide whether `ai`, `manual`, or `edit` is launchable; the wizard remains entitlement-agnostic. Existing create/edit routes and save APIs stay in place.

## Open Questions

- [ ] None blocking. If product later wants editable method/path in edit mode, treat it as a separate backend-contract change.
