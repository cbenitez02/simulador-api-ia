# endpoint-creation-flow Specification

## Purpose

Define one mode-aware endpoint flow for `ai`, `manual`, and `edit` without changing backend contracts.

## Requirements

### Requirement: Unified Mode Entry And Draft Seam

The system MUST expose a single endpoint-creation flow for `ai`, `manual`, and `edit`, and each mode MUST enter the same downstream draft editor and save seam once a draft exists.

#### Scenario: Each mode chooses its own first step

- GIVEN a caller launches `ai`, `manual`, or `edit`
- WHEN the flow initializes
- THEN `ai` SHALL start at prompt entry, `manual` SHALL start at method/path entry, and `edit` SHALL start from the existing endpoint draft

#### Scenario: Drafts converge before editing

- GIVEN a draft came from AI preview, manual basics, or an existing endpoint
- WHEN the user advances past entry
- THEN the shared editor and save pipeline SHALL use the same draft contract for all modes

### Requirement: Backend Method Compatibility

The system MUST expose only the HTTP methods supported by the backend create-endpoint contract for this flow: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.

#### Scenario: Manual and review selectors match backend support

- GIVEN a user opens manual entry or the shared review step
- WHEN method choices are rendered
- THEN the available choices SHALL exactly match the backend-supported set and SHALL NOT omit `HEAD` or `OPTIONS`

### Requirement: Mode-Aware Shared UX

The system MUST make shared labels, empty states, and lock semantics mode-aware, and manual or edit flows MUST NOT imply AI provenance.

#### Scenario: Manual and edit copy avoids AI assumptions

- GIVEN the flow is in `manual` or `edit`
- WHEN shared review or editor content renders
- THEN labels, helper text, and empty states SHALL describe manual or existing data without AI-specific wording

#### Scenario: AI lock messaging stays contextual

- GIVEN the flow is in `ai`
- WHEN locked or AI-derived fields are shown
- THEN the UI MAY explain AI-derived locks, but that language SHALL stay isolated to AI mode

### Requirement: Partial-Save Visibility And Recovery Expectations

The system MUST surface that save still spans multiple calls, MUST make any partial-save outcome visible, and MUST tell the user what can be retried or continued without claiming transactional rollback.

#### Scenario: User sees actionable partial-save outcome

- GIVEN save created or updated only part of the endpoint payload
- WHEN the flow reports the result
- THEN the UI SHALL identify that the save was partial and SHALL present a recovery path or next action based on what succeeded

### Requirement: Edit-Mode Method And Path Compatibility Boundary

This change MUST treat edit-mode method/path persistence as a compatibility concern to evaluate in design, not as guaranteed acceptance scope. If the shared seam is unsafe, the system SHALL keep current persistence behavior visible instead of implying that method/path edits are saved.

#### Scenario: Unsafe edit seam keeps current expectation explicit

- GIVEN edit-mode method/path persistence is not safely supported by the shared seam
- WHEN a user edits those fields in `edit` mode
- THEN the flow SHALL preserve explicit UX messaging about the limitation rather than promising persistence
