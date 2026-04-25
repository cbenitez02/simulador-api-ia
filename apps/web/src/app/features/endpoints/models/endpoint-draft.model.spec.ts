import { describe, expect, it } from 'vitest';
import { createManualEndpointDraft, endpointDraftLocksForMode, statusCodeForDraftMethod } from './endpoint-draft.model';

describe('endpoint-draft.model', () => {
  it('creates seeded manual drafts with normalized method, route, and unlocked basics', () => {
    const result = createManualEndpointDraft('HEAD', 'health');

    expect(result).toMatchObject({
      method: 'HEAD',
      route: '/health',
      statusCode: 200,
      source: 'manual',
      locks: {
        method: false,
        path: false,
        scenarioType: false,
      },
    });
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]).toMatchObject({
      name: 'Success',
      type: 'success',
      statusCode: 200,
    });
  });

  it('locks method and path for edit mode without locking scenario types', () => {
    expect(endpointDraftLocksForMode('manual')).toEqual({
      method: false,
      path: false,
      scenarioType: false,
    });
    expect(endpointDraftLocksForMode('edit')).toEqual({
      method: true,
      path: true,
      scenarioType: false,
    });
  });

  it('maps supported draft methods to stable default success status codes', () => {
    expect(statusCodeForDraftMethod('POST')).toBe(201);
    expect(statusCodeForDraftMethod('DELETE')).toBe(204);
    expect(statusCodeForDraftMethod('OPTIONS')).toBe(200);
  });
});
