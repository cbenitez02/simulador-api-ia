# Audit history false positives on scenario edits

## Purpose

This document explains a verified bug in `simulador-api-ia` where editing a single endpoint scenario creates extra audit history entries for changes the user did not actually make.

It is written so another AI or engineer can continue the fix with minimal re-discovery.

---

## Reported symptom

When a user edits a single `success` scenario inside an endpoint, the audit history shows additional `updated` changes that were not made explicitly, including:

- sibling scenarios from the same endpoint
- the endpoint itself
- the endpoint config

This makes audit history noisy and misleading.

---

## Verified root cause

This is **not** primarily a rendering or diff visualization problem in the audit history UI.

The bug is caused by a combination of:

1. **Frontend full-save behavior**
   - Editing a scenario triggers a full endpoint save flow, not a scenario-only mutation.
2. **Frontend scenario reconciliation without no-op detection**
   - Existing scenarios are patched even when their payload did not change.
3. **Backend audit writes without no-op detection**
   - `updated` audit events are written whenever an update route is called, even if the effective state before and after is identical.

---

## Evidence and affected code paths

### 1. Editing a scenario saves the whole endpoint

Frontend entry point:

- `apps/web/src/app/features/endpoints/components/create-endpoint-page/create-endpoint-page.component.ts`

Relevant behavior:

- `saveEndpoint()` calls `endpointsRepository.saveEndpoint(projectId, draft, editingEndpointId)`.
- This means a scenario edit does **not** go through an isolated scenario mutation path.

### 2. Full endpoint save always reconciles all scenarios

Frontend repository:

- `apps/web/src/app/features/endpoints/data-access/endpoints.repository.ts`

Verified flow in `saveEndpoint()` for existing endpoints:

1. `PATCH /projects/:projectId/endpoints/:endpointId`
2. `PUT /endpoints/:id/config`
3. `reconcileScenarios(endpoint.id, draft)`

### 3. Existing scenarios are always patched

Same file:

- `apps/web/src/app/features/endpoints/data-access/endpoints.repository.ts`

Verified behavior in `reconcileScenarios()`:

- It loads current scenarios with `GET /endpoints/:endpointId/scenarios`
- For every draft scenario with an existing `id`, it sends:
  - `PATCH /endpoints/:endpointId/scenarios/:scenarioId`
- It does this **without comparing** the existing scenario payload against the draft payload first.

This is the main reason sibling scenarios receive fake `updated` events.

### 4. Backend always audits updates as real changes

Scenario service:

- `apps/backend/src/management/scenarios/service.ts`

Endpoint service:

- `apps/backend/src/management/endpoints/service.ts`

Endpoint config service:

- `apps/backend/src/management/endpoint-config/service.ts`

Verified behavior:

- `updateScenario()` writes an `updated` audit event after update execution without comparing previous vs next state.
- `updateEndpoint()` writes an `updated` audit event unconditionally.
- `upsertEndpointConfig()` writes an `updated` audit event unconditionally.

This means that even if the frontend sends unnecessary updates, the backend currently turns those no-op writes into audit noise instead of suppressing them.

### 5. Audit history UI is not computing structural diffs

Audit event persistence / mapping:

- `apps/backend/src/management/audit-events/service.ts`
- `apps/web/src/app/features/audit-history/adapters/audit-history-api.mapper.ts`

Verified behavior:

- Audit events currently store timeline metadata and summary labels.
- The history UI maps and displays those entries.
- There is no evidence that the UI is inventing change diffs from endpoint/scenario payloads.

Conclusion:

- The false positives originate in the save + audit flow, not in the audit history renderer.

---

## Fix strategy

The correct resolution is to implement **both** layers:

### Layer A — frontend: stop sending unnecessary scenario patches

Modify:

- `apps/web/src/app/features/endpoints/data-access/endpoints.repository.ts`

Required change:

- In `reconcileScenarios()`, compare the draft scenario against the existing scenario before calling `PATCH`.
- Only send `PATCH` when one of these effective fields actually changed:
  - `name`
  - `type`
  - `statusCode`
  - `body`
  - `delayMs`
  - `weight`

Notes:

- The comparison should use the same canonical payload shape that will be sent to the backend.
- Do **not** compare draft-only UI fields if they are not part of persisted scenario state.

### Layer B — backend: suppress audit events for no-op updates

Modify:

- `apps/backend/src/management/scenarios/service.ts`
- `apps/backend/src/management/endpoints/service.ts`
- `apps/backend/src/management/endpoint-config/service.ts`

Required change:

- Before writing an `updated` audit event, compare the persisted state before and after the mutation.
- If the effective state did not change, do not emit an `updated` audit event.
- Ideally, avoid unnecessary DB writes too when practical and safe.

Notes:

- Backend hardening is required even after the frontend fix, because other clients could still call these endpoints directly.

---

## Recommended implementation order

1. **Frontend no-op detection for scenario reconciliation**
   - Cuts redundant requests immediately.
2. **Backend no-op suppression for scenario updates**
   - Prevents false audit entries even if a client still sends redundant patches.
3. **Backend no-op suppression for endpoint updates**
   - Prevents parent endpoint audit noise during scenario-focused saves.
4. **Backend no-op suppression for endpoint config upserts**
   - Prevents config audit noise from the same save flow.
5. **Tests**
   - Add/adjust tests before closing the issue.

---

## Suggested implementation details

### Frontend comparison helper

Add a helper in `endpoints.repository.ts` that converts both:

- the existing API scenario
- the draft scenario

into the same comparable shape.

For example, compare a normalized object like:

```ts
{
  name,
  type,
  statusCode,
  body,
  delayMs,
  weight,
}
```

Then call `PATCH` only when those normalized objects differ.

Important:

- `body` may require deep equality.
- If there is implicit normalization in current code, compare normalized values, not raw user input.

### Backend no-op guard pattern

For each update service:

1. Load the current persisted record.
2. Build the effective next-state payload.
3. Compare current vs next for auditable fields.
4. If identical:
   - return the existing/current representation or skip audit emission after harmless write handling
5. If different:
   - execute mutation
   - emit audit event

If architectural constraints make pre-check + conditional write awkward, the minimum acceptable behavior is:

- still execute the write if needed by current service shape
- but suppress the audit event when effective state did not change

---

## Tests that should be added or updated

### Frontend

File likely to update:

- `apps/web/src/app/features/endpoints/data-access/endpoints.repository.spec.ts`

Add coverage for:

1. **unchanged existing scenario is not patched**
2. **changed existing scenario is patched**
3. **new scenario is still created**
4. **removed scenario is still deleted**

### Backend

Likely files:

- `apps/backend/src/__tests__/app.integration.test.ts`
- or focused service tests if present / preferred for these modules

Add coverage for:

1. scenario update with identical effective payload does **not** emit audit event
2. scenario update with real field change **does** emit audit event
3. endpoint update with identical effective payload does **not** emit audit event
4. endpoint-config update/upsert with identical effective payload does **not** emit audit event

If integration coverage is too expensive, unit/service-level tests are acceptable as long as they verify audit suppression behavior explicitly.

---

## Acceptance criteria

The fix is complete only when all of the following are true:

1. Editing one scenario no longer creates audit history entries for unchanged sibling scenarios.
2. Editing one scenario no longer creates fake `updated` audit entries for endpoint/config when effective state did not change.
3. Real changes still generate audit entries.
4. Scenario create/delete behavior remains unchanged.
5. Existing endpoint save flows still work.

---

## Risks and pitfalls

### 1. Deep equality on `body`

Scenario `body` is not guaranteed to be primitive.

Risk:

- shallow comparison will produce false positives

Mitigation:

- use stable deep equality on canonical values

### 2. Comparing non-canonical values

Risk:

- comparing user input before normalization may treat semantically identical values as different

Mitigation:

- compare the same normalized payload shape used for persistence

### 3. Fixing only frontend

Risk:

- direct API callers can still generate audit noise

Mitigation:

- keep backend suppression as a mandatory hardening layer

### 4. Fixing only backend

Risk:

- audit noise may disappear, but unnecessary requests and writes still happen

Mitigation:

- still implement frontend no-op detection

---

## Files expected to change during implementation

- `apps/web/src/app/features/endpoints/data-access/endpoints.repository.ts`
- `apps/web/src/app/features/endpoints/data-access/endpoints.repository.spec.ts`
- `apps/backend/src/management/scenarios/service.ts`
- `apps/backend/src/management/endpoints/service.ts`
- `apps/backend/src/management/endpoint-config/service.ts`
- `apps/backend/src/__tests__/app.integration.test.ts` and/or focused service tests

---

## Short handoff summary for another AI

If you need the shortest possible instruction set:

1. Do **not** debug the audit history UI first.
2. Start in `apps/web/.../endpoints.repository.ts`.
3. Make `reconcileScenarios()` skip `PATCH` for unchanged existing scenarios.
4. Then harden backend update services so no-op updates do not emit audit events.
5. Add tests proving unchanged scenario/endpoint/config updates do not create audit noise.

That is the real fix path.
