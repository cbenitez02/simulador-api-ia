import { describe, expect, it } from 'vitest';
import {
  endpointSaveRecoveryMessage,
  endpointWizardSubtitle,
  endpointWizardTitle,
  projectRecoverySubtitle,
  reviewStepCopy,
} from './endpoint-flow-ui';

describe('endpoint-flow-ui', () => {
  it('returns mode-aware wizard titles and subtitles', () => {
    expect(endpointWizardTitle('manual')).toBe('Create endpoint');
    expect(endpointWizardTitle('edit')).toBe('Edit endpoint');
    expect(endpointWizardSubtitle('ai', 'prompt')).toBe('Describe your endpoint');
    expect(endpointWizardSubtitle('manual', 'review')).toBe('Set endpoint basics');
    expect(endpointWizardSubtitle('edit', 'editor')).toBe('Configure endpoint');
  });

  it('keeps manual review copy free from ai wording', () => {
    expect(reviewStepCopy('manual')).toEqual({
      title: 'Set endpoint basics',
      description: 'Choose the method and route for this endpoint',
      editableBadge: 'Editable',
      lockedBadge: 'Locked',
    });
    expect(reviewStepCopy('ai').lockedBadge).toBe('Locked by AI preview');
  });

  it('maps partial save stages into recovery guidance', () => {
    expect(endpointSaveRecoveryMessage('config', 'Config persistence failed', true)).toContain(
      'Endpoint basics were saved, but configuration failed.',
    );
    expect(endpointSaveRecoveryMessage('refresh', 'Detail refresh failed', true)).toContain('final refresh failed');
    expect(endpointSaveRecoveryMessage('endpoint-core', 'Core failed', false)).toBe('Core failed');
  });

  it('explains that project recovery continues with manual endpoint setup', () => {
    expect(projectRecoverySubtitle()).toBe(
      'Your project is ready. Continue with manual endpoint setup without creating a duplicate project.',
    );
  });
});
