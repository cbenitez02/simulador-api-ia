# Implementation Progress

**Change**: manual-endpoint-creation  
**Mode**: Strict TDD

### Completed Tasks

- [x] Added retrievable apply-progress evidence for the remediation pass.
- [x] Fixed the change-related web spec lint/typecheck failures.
- [x] Added runtime proof that AI mode starts on the prompt step.
- [x] Added runtime proof that partial-project recovery reopens the shared manual flow.
- [x] Strengthened unit coverage around editor/review flow helpers and interactions.

### Files Changed

| File                                                                                                                       | Action   | What Was Done                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/features/endpoints/components/create-endpoint-page/create-endpoint-page.integration.spec.ts`             | Modified | Removed the unused repository error import and added explicit AI bootstrap runtime coverage.                                         |
| `apps/web/src/app/features/endpoints/data-access/endpoints.repository.spec.ts`                                             | Modified | Switched `EndpointSaveError` to a type-only import and replaced invalid generic matcher usage with `satisfies`-checked expectations. |
| `apps/web/src/app/features/endpoints/components/create-endpoint-editor-step/create-endpoint-editor-step.component.spec.ts` | Modified | Replaced helper-only assertions with component-level behavior tests for method updates, edit locks, and preset creation.             |
| `apps/web/src/app/features/endpoints/components/create-endpoint-review-step/create-endpoint-review-step.component.spec.ts` | Modified | Added component-level runtime assertions for editable vs locked basics-step behavior.                                                |
| `apps/web/src/app/features/workspace-shell/workspace-shell.integration.spec.ts`                                            | Modified | Added an integration proof that partial project recovery opens the manual endpoint flow.                                             |
| `apps/web/src/app/shared/utils/endpoint-flow-ui.spec.ts`                                                                   | Created  | Added direct helper coverage for wizard copy, recovery messaging, and project recovery subtitle behavior.                            |

### TDD Cycle Evidence

| Task                                      | Test File                                                                                                                    | Layer       | Safety Net                                            | RED                                                                                              | GREEN                                                                       | TRIANGULATE                                                                           | REFACTOR       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------- |
| Remediate spec lint/typecheck regressions | `create-endpoint-page.integration.spec.ts`, `endpoints.repository.spec.ts`                                                   | Unit/Static | ✅ 60/60 targeted tests passing before edits          | ✅ Existing lint/typecheck failures were the red signal from verify and were fixed in-spec first | ✅ `pnpm typecheck:web:spec` passed and ESLint passed on changed spec files | ✅ Covered both unused-import and matcher typing regressions                          | ➖ None needed |
| Prove AI mode starts on prompt            | `create-endpoint-page.integration.spec.ts`                                                                                   | Integration | ✅ 60/60                                              | ✅ Added explicit AI bootstrap assertion before final verification run                           | ✅ Included in final targeted Vitest run (68/68)                            | ✅ Paired with existing manual bootstrap and AI retry/runtime tests                   | ➖ None needed |
| Prove recovery reuses shared manual flow  | `workspace-shell.integration.spec.ts`                                                                                        | Integration | ✅ 60/60                                              | ✅ Added partial-recovery manual-entry assertion before final verification run                   | ✅ Included in final targeted Vitest run (68/68)                            | ✅ Complements the existing unit recovery routing test with runtime integration proof | ➖ None needed |
| Strengthen editor/review/helper coverage  | `create-endpoint-editor-step.component.spec.ts`, `create-endpoint-review-step.component.spec.ts`, `endpoint-flow-ui.spec.ts` | Unit        | ✅ 60/60 for existing files / N/A for new helper spec | ✅ Added behavior-first tests before rerunning the suite                                         | ✅ Included in final targeted Vitest run (68/68)                            | ✅ Multiple editable, locked, preset, and message scenarios                           | ➖ None needed |

### Test Summary

- **Safety net baseline**: `pnpm --dir apps/web exec vitest run ...` → **60 passed / 0 failed** before edits
- **Total tests added or rewritten in this remediation**: 12
- **Final targeted tests**: `pnpm exec vitest run ...` → **68 passed / 0 failed**
- **Layers used for new coverage**: Unit (10), Integration (2), E2E (0)
- **Approval tests**: None — no production refactor required
- **Pure functions created**: 0

### Deviations from Design

None — remediation stays within the approved scope and does not widen edit-mode method/path persistence.

### Issues Found

None in the changed scope after the targeted lint, typecheck, and test reruns.

### Remaining Tasks

- [ ] Re-run SDD verify for `manual-endpoint-creation` against the new evidence artifact.

### Status

Remediation complete. Ready for verify.
