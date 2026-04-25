import type {
  CreateEndpointStep,
  EndpointFlowMode,
  SaveStage,
} from '../../features/endpoints/models/endpoint-draft.model';

export function endpointWizardTitle(mode: EndpointFlowMode): string {
  return mode === 'edit' ? 'Edit endpoint' : 'Create endpoint';
}

export function endpointWizardSubtitle(mode: EndpointFlowMode, step: CreateEndpointStep): string {
  if (mode === 'edit') return 'Configure endpoint';
  if (mode === 'manual') {
    return step === 'review' ? 'Set endpoint basics' : 'Configure endpoint';
  }

  switch (step) {
    case 'prompt':
      return 'Describe your endpoint';
    case 'review':
      return 'Review basics';
    default:
      return 'Configure endpoint';
  }
}

export function reviewStepCopy(mode: Extract<EndpointFlowMode, 'ai' | 'manual'>): {
  title: string;
  description: string;
  editableBadge: string;
  lockedBadge: string;
} {
  if (mode === 'manual') {
    return {
      title: 'Set endpoint basics',
      description: 'Choose the method and route for this endpoint',
      editableBadge: 'Editable',
      lockedBadge: 'Locked',
    };
  }

  return {
    title: 'Review endpoint basics',
    description: 'Confirm or edit the inferred method and route',
    editableBadge: 'Inferred',
    lockedBadge: 'Locked by AI preview',
  };
}

export function editorSourcePrompt(mode: EndpointFlowMode, sourcePrompt: string): string {
  const trimmed = sourcePrompt.trim();
  if (trimmed) return trimmed;
  if (mode === 'manual') return 'Manual endpoint setup';
  if (mode === 'edit') return 'Existing endpoint details';
  return 'AI-generated draft';
}

export function editMethodPathNotice(mode: EndpointFlowMode): string | null {
  if (mode !== 'edit') return null;
  return 'Method and route stay read-only in edit mode for now. Those fields are not saved on existing endpoints yet.';
}

export function endpointSaveRecoveryMessage(stage: SaveStage, message: string, partial: boolean): string {
  if (!partial) return message;

  const stageLabel =
    stage === 'config'
      ? 'configuration'
      : stage === 'scenarios'
        ? 'scenario updates'
        : stage === 'refresh'
          ? 'final refresh'
          : 'save';

  return `Endpoint basics were saved, but ${stageLabel} failed. ${message} You can keep editing and save again to finish the remaining setup.`;
}

export function projectRecoverySubtitle(): string {
  return 'Your project is ready. Continue with manual endpoint setup without creating a duplicate project.';
}
