## Exploration: manual-endpoint-creation

### Current State

- The backend already supports manual persistence through `POST /api/v1/projects/:projectId/endpoints` plus config/scenario endpoints; AI is only required for draft generation (`/ai-preview`) and direct AI persistence (`/ai-generate`).
- The frontend wizard is centralized in `CreateEndpointPageComponent`, but its create flow is AI-first: it always starts on `prompt`, calls `EndpointAiGeneratorService`, then moves to the route/method review step, then the shared editor.
- The shared save pipeline is already mode-agnostic once a draft exists: `EndpointsRepository.saveEndpoint()` persists endpoint, config, scenarios, and refreshes detail for both manual and AI-derived drafts.
- The domain model already anticipates non-AI creation: `EndpointDraft.source` supports `'manual' | 'ai-preview' | 'existing'`, and tests already cover a manual save flow by forcing the wizard directly into `editor` with a manual draft.

### Affected Areas

- `apps/web/src/app/features/endpoints/components/create-endpoint-page/create-endpoint-page.component.ts` — main architectural seam; currently couples create flow bootstrap to AI prompt/review behavior.
- `apps/web/src/app/features/endpoints/components/create-endpoint-page/create-endpoint-page.component.html` — step rendering/footer logic is hard-coded to `prompt/review/editor` with AI copy in step 1.
- `apps/web/src/app/features/endpoints/components/create-endpoint-prompt-step/*` — AI-specific entry step and copy.
- `apps/web/src/app/features/endpoints/components/create-endpoint-review-step/*` — likely best reusable manual entry step for method/path capture.
- `apps/web/src/app/features/endpoints/components/create-endpoint-editor-step/*` — shared editor already reusable once a draft exists.
- `apps/web/src/app/features/endpoints/data-access/endpoints.repository.ts` — shared persistence seam; no manual backend gap here.
- `apps/web/src/app/features/workspace-shell/workspace-shell.component.ts` — launch points for create flow and create-project partial-success “continue manually” path.
- `apps/web/src/app/shared/ui/create-project-modal/*` — current project creation copy/actions assume AI is optional, but “continue manually” does not open the wizard yet.
- `apps/backend/src/management/endpoints/router.ts` / `service.ts` / `schema.ts` — existing manual create contract and duplicate protection.
- `apps/backend/src/management/ai/router.ts` / `service.ts` / `schema.ts` — AI-specific routes that should stay additive, not become a prerequisite.

### Approaches

1. **Separate manual wizard/page** — add a second create flow just for manual mode.
   - Pros: lowest short-term risk to existing AI flow; easy to gate by plan.
   - Cons: duplicates shell/stepper/editor orchestration; high drift risk; contradicts reuse goal and preferred UX direction.
   - Effort: Medium

2. **Mode-aware unified wizard (recommended)** — keep `CreateEndpointPageComponent` as the single flow, add a `creationMode` seam (`ai | manual | edit`), and vary step bootstrap/labels/components by mode.
   - Pros: preserves current design, maximizes reuse, keeps save/editor logic shared, makes plan gating a caller concern instead of spreading it across internals.
   - Cons: requires refactoring current step state from AI-first assumptions to a draft/session model.
   - Effort: Medium

3. **Backend-first new manual draft endpoint** — create a dedicated backend/manual draft API to feed the wizard.
   - Pros: could centralize defaults and future plan logic on the server.
   - Cons: unnecessary today because manual persistence already exists and frontend can seed defaults locally; adds API surface without solving the real coupling.
   - Effort: Medium/High

### Recommendation

Use a **mode-aware unified wizard**.

Recommended seam:

- Add an explicit creation mode at the page boundary (`ai`, `manual`, `edit`).
- Refactor `CreateEndpointPageComponent` so flow bootstrapping is based on **how the draft is obtained**, not on AI being mandatory.
- For `manual`, initialize a local default unlocked `EndpointDraft` and start on a reused basics step built from `create-endpoint-review-step` (method + route, no locks, default `GET` + empty route).
- Keep the editor and save pipeline shared exactly as they are.
- Keep AI behavior as one mode of the same wizard: prompt -> inferred basics review -> editor.
- Keep plan gating outside the wizard (workspace shell / project modal / future entitlement service), so free users can launch `manual` and pro users can additionally launch `ai`.

This keeps compatibility because the persistence contract does not change, and it preserves design because the same shell, stepper, and editor remain the center of the experience.

### Risks

- **Current create flow is UI-only unified, not transactionally unified**: `saveEndpoint()` creates endpoint, then config, then scenarios via separate calls; manual usage growth will expose the existing partial-save risk more often.
- **Edit flow already has a hidden inconsistency**: existing drafts are unlocked for method/path in the editor, but backend `PATCH /projects/:projectId/endpoints/:endpointId` does not persist method/path changes. Refactoring should avoid baking this inconsistency deeper.
- **Frontend/backend method mismatch**: backend accepts `HEAD` and `OPTIONS`, but frontend types/options only expose `GET/POST/PUT/PATCH/DELETE`.
- **Project partial-success UX is unfinished for manual continuation**: `continueCreateProjectManually()` returns the user to dashboard instead of opening the manual endpoint wizard for the created project.
- **AI lock semantics are embedded in review/editor copy**: labels like “Locked by AI preview” and prompt-specific text must become mode-aware to avoid confusing manual users.

### Ready for Proposal

Yes — proposal should describe a unified mode-aware wizard, caller-level plan gating, reuse of the current review/editor steps, and explicit handling of the existing partial-success/manual-continuation gap.
