import type {
  ProjectSnapshotActorDto,
  ProjectSnapshotDetailDto,
  ProjectSnapshotDto,
} from '../../../shared/http/api.types';
import type { ProjectSnapshot, ProjectSnapshotDetail } from '../models/project-snapshot.model';

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
    createdBy: mapSnapshotActor(snapshot.createdBy),
  };
}

export function mapProjectSnapshotDetailFromApi(snapshot: ProjectSnapshotDetailDto): ProjectSnapshotDetail {
  return {
    ...mapProjectSnapshotFromApi(snapshot),
    payload: snapshot.payload,
  };
}
