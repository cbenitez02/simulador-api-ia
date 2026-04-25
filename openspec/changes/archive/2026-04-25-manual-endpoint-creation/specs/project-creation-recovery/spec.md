# project-creation-recovery Specification

## Purpose

Define how project-creation recovery continues into the unified manual endpoint flow.

## Requirements

### Requirement: Partial-Success Manual Continuation

The system MUST let a project-creation flow that created the project but did not finish endpoint setup continue directly into manual endpoint creation for that project.

#### Scenario: Continue manually after partial success

- GIVEN project creation returns a created project and unfinished endpoint setup
- WHEN the user chooses the continuation action
- THEN the application SHALL open the unified endpoint flow in `manual` mode for that project

### Requirement: Recovery Reuses The Shared Manual Flow

The recovery path MUST reuse the same manual entry step, method set, editor contract, and save expectations as ordinary manual creation.

#### Scenario: Recovery lands on the same basics step

- GIVEN the user enters from project-creation recovery
- WHEN the manual flow opens
- THEN the first step SHALL be the shared method/path step and downstream behavior SHALL match standard manual creation

### Requirement: Recovery Messaging And Risk Clarity

The system MUST confirm that project creation succeeded, MUST frame continuation as manual setup, and MUST preserve the same partial-save visibility and recovery expectations used by the main endpoint flow.

#### Scenario: Recovery copy explains state and next action

- GIVEN the user arrives from partial-success recovery
- WHEN recovery messaging is shown
- THEN the content SHALL confirm project success, explain manual continuation, and SHALL NOT present the action as an AI retry
