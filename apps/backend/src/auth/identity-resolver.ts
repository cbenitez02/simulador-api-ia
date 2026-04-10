import { prisma } from '../lib/prisma.js';
import type { AuthenticatedActor, ResolvedExternalIdentity } from './types.js';

type ExternalIdentityRecord = {
  provider: string;
  subject: string;
  userId?: string;
  user: {
    id: string;
    memberships: Array<{ workspaceId: string; role: string }>;
    personalWorkspace: { id: string } | null;
  };
};

const actorIdentityInclude = {
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      memberships: {
        select: {
          workspaceId: true,
          role: true,
        },
      },
      personalWorkspace: {
        select: {
          id: true,
        },
      },
    },
  },
} as const;

function toActor(
  identity: ResolvedExternalIdentity,
  record: ExternalIdentityRecord
): AuthenticatedActor {
  return {
    userId: record.user.id,
    personalWorkspaceId: record.user.personalWorkspace?.id ?? null,
    identity: {
      provider: identity.provider,
      subject: identity.subject,
    },
    workspaceMemberships: record.user.memberships.map((membership) => ({
      workspaceId: membership.workspaceId,
      role: membership.role,
    })),
  };
}

function buildPersonalWorkspaceName(identity: ResolvedExternalIdentity): string {
  const baseName = identity.displayName?.trim() || identity.email?.trim() || identity.subject;
  return `${baseName} Personal Workspace`;
}

function hasProfileChanges(
  record: {
    email?: string | null;
    emailVerified?: boolean;
    displayName?: string | null;
    user: { email?: string | null; displayName?: string | null };
  },
  identity: ResolvedExternalIdentity
): boolean {
  return (
    record.user.email !== identity.email ||
    record.user.displayName !== identity.displayName ||
    record.email !== identity.email ||
    record.emailVerified !== identity.emailVerified ||
    record.displayName !== identity.displayName
  );
}

export async function resolveActorIdentity(
  identity: ResolvedExternalIdentity
): Promise<AuthenticatedActor> {
  const existingIdentity = await prisma.externalIdentity.findUnique({
    where: {
      provider_subject: {
        provider: identity.provider,
        subject: identity.subject,
      },
    },
    include: actorIdentityInclude,
  });

  if (existingIdentity) {
    if (
      hasProfileChanges(
        existingIdentity as ExternalIdentityRecord & {
          email?: string | null;
          emailVerified?: boolean;
          displayName?: string | null;
          user: {
            email?: string | null;
            displayName?: string | null;
            memberships: Array<{ workspaceId: string; role: string }>;
            personalWorkspace: { id: string } | null;
          };
        },
        identity
      )
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingIdentity.user.id },
          data: {
            ...(identity.email !== undefined ? { email: identity.email } : {}),
            ...(identity.displayName !== undefined ? { displayName: identity.displayName } : {}),
          },
        });

        await tx.externalIdentity.update({
          where: {
            provider_subject: {
              provider: identity.provider,
              subject: identity.subject,
            },
          },
          data: {
            ...(identity.email !== undefined ? { email: identity.email } : {}),
            emailVerified: identity.emailVerified,
            ...(identity.displayName !== undefined ? { displayName: identity.displayName } : {}),
          },
        });
      });
    }

    return toActor(identity, existingIdentity as ExternalIdentityRecord);
  }

  const createdIdentity = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...(identity.email !== undefined ? { email: identity.email } : {}),
        ...(identity.displayName !== undefined ? { displayName: identity.displayName } : {}),
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: buildPersonalWorkspaceName(identity),
        kind: 'personal',
        personalForUserId: user.id,
      },
    });

    await tx.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
      },
    });

    return tx.externalIdentity.create({
      data: {
        userId: user.id,
        provider: identity.provider,
        subject: identity.subject,
        ...(identity.email !== undefined ? { email: identity.email } : {}),
        emailVerified: identity.emailVerified,
        ...(identity.displayName !== undefined ? { displayName: identity.displayName } : {}),
      },
      include: actorIdentityInclude,
    });
  });

  return toActor(identity, createdIdentity as ExternalIdentityRecord);
}
