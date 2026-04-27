import { describe, expect, it } from 'vitest';
import { mapAuditEventFromApi } from './audit-history-api.mapper';

describe('audit-history-api.mapper', () => {
  it('maps contract audit events to explicit contract labels', () => {
    const mapped = mapAuditEventFromApi({
      id: 'audit-1',
      actor: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      resourceType: 'contract',
      resourceId: 'project-1',
      action: 'exported',
      summary: 'Exported OpenAPI contract for Users API',
      metadata: { contractName: 'Users API' },
      createdAt: '2026-04-18T21:00:00.000Z',
    });

    expect(mapped.resourceLabel).toBe('Users API');
    expect(mapped.actionLabel).toBe('exported contract');
  });

  it('maps analyzed contract audit events to an explicit label', () => {
    const mapped = mapAuditEventFromApi({
      id: 'audit-2',
      actor: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      resourceType: 'contract',
      resourceId: 'project-1',
      action: 'analyzed',
      summary: 'Analyzed OpenAPI contract for Users API',
      metadata: { contractName: 'Users API' },
      createdAt: '2026-04-18T21:05:00.000Z',
    });

    expect(mapped.actionLabel).toBe('analyzed contract');
  });

  it('maps snapshot audit events into revision-facing labels with metadata summaries', () => {
    const mapped = mapAuditEventFromApi({
      id: 'audit-3',
      actor: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      resourceType: 'snapshot',
      resourceId: 'snapshot-1',
      action: 'restored',
      summary: 'Restored revision Before imports',
      metadata: {
        snapshotName: 'Before imports',
        restoredEndpointCount: 2,
        scenarioCount: 3,
        deletedEndpointCount: 1,
        scope: 'unset',
      },
      createdAt: '2026-04-18T21:10:00.000Z',
    });

    expect(mapped.resourceTypeLabel).toBe('revision');
    expect(mapped.actionLabel).toBe('restored revision');
    expect(mapped.detailsLabel).toBe('2 endpoints · 3 scenarios · 1 deleted · scope unset');
  });
});
