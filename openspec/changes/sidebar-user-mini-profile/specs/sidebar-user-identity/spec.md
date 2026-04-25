# sidebar-user-identity Specification

## Purpose

Define how authenticated user identity is shown in the main workspace sidebar.

## Requirements

### Requirement: Sidebar User Identity Placement

The system MUST render a compact user identity section between the active project card and the sidebar sign-out action.

#### Scenario: Identity section appears in the expected layout position

- GIVEN the workspace sidebar renders the active project and sign-out controls
- WHEN an authenticated user identity is available
- THEN the sidebar SHALL place the user identity section after the active project card and before the sign-out action

### Requirement: Authenticated Identity Content

The user identity section MUST display the signed-in user name and SHOULD display avatar imagery when available from the frontend auth snapshot.

#### Scenario: Avatar URL is present

- GIVEN the auth snapshot state is authenticated with `displayName` and `avatarUrl`
- WHEN the sidebar renders
- THEN the section SHALL show the display name and avatar image

#### Scenario: Avatar URL is missing

- GIVEN the auth snapshot state is authenticated with a display name but no avatar URL
- WHEN the sidebar renders
- THEN the section SHALL show the display name and SHALL render a deterministic initials fallback avatar

### Requirement: Backward-Compatible Sign-out Behavior

The new identity section MUST NOT change sign-out availability or event behavior.

#### Scenario: Sign-out action still emits existing event

- GIVEN the sidebar renders with sign-out enabled
- WHEN the user activates sign-out
- THEN the component SHALL emit the existing `signOutRequested` event exactly as before
