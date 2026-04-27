import type {
  ProjectSnapshotActorDto,
  ProjectSnapshotDetailDto,
  ProjectSnapshotDto,
  ProjectSnapshotRestorePreviewDto,
} from '../../../shared/http/api.types';
import type {
  ProjectSnapshot,
  ProjectSnapshotDetail,
  ProjectSnapshotRevisionMetadata,
  ProjectSnapshotRestorePreview,
} from '../models/project-snapshot.model';

const DEFAULT_REVISION_METADATA: ProjectSnapshotRevisionMetadata = {
  endpointCount: 0,
  scenarioCount: 0,
  globalScope: null,
  projectSlug: null,
  projectName: null,
  isLegacySnapshot: true,
};

function mapSnapshotActor(actor: ProjectSnapshotActorDto) {
  return {
    userId: actor.userId,
    email: actor.email,
    displayName: actor.displayName,
    label: actor.displayName ?? actor.email ?? actor.userId,
  };
}

export function mapProjectSnapshotFromApi(snapshot: ProjectSnapshotDto): ProjectSnapshot {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    name: snapshot.name,
    description: snapshot.description,
    createdAt: snapshot.createdAt,
    revision: snapshot.revision ?? DEFAULT_REVISION_METADATA,
    createdBy: mapSnapshotActor(snapshot.createdBy),
  };
}

export function mapProjectSnapshotDetailFromApi(snapshot: ProjectSnapshotDetailDto): ProjectSnapshotDetail {
  return {
    ...mapProjectSnapshotFromApi(snapshot),
    payload: snapshot.payload,
  };
}

export function mapProjectSnapshotRestorePreviewFromApi(
  preview: ProjectSnapshotRestorePreviewDto,
): ProjectSnapshotRestorePreview {
  return {
    snapshotId: preview.snapshotId,
    snapshotName: preview.snapshotName,
    revision: preview.revision ?? DEFAULT_REVISION_METADATA,
    project: preview.project,
    globalConfig: preview.globalConfig,
    endpoints: preview.endpoints,
    counts: preview.counts,
  };
}
