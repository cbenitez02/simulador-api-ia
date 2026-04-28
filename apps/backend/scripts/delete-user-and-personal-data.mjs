/**
 * Deletes a User by id and removes their personal workspace (and cascaded data)
 * so Clerk can re-register the same email with a new subject.
 *
 * Usage (from apps/backend):
 *   node --env-file=.env scripts/delete-user-and-personal-data.mjs <userId>
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const userId = process.argv[2];

if (!userId || userId.startsWith('-')) {
  console.error('Usage: node --env-file=.env scripts/delete-user-and-personal-data.mjs <userId>');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    personalWorkspace: { select: { id: true } },
  },
});

if (!user) {
  console.error(`User not found: ${userId}`);
  process.exit(1);
}

console.log(`Deleting user ${user.id} (${user.email ?? 'no email'})`);

await prisma.$transaction(async (tx) => {
  const personalWorkspaceId = user.personalWorkspace?.id;

  if (personalWorkspaceId) {
    await tx.workspace.delete({ where: { id: personalWorkspaceId } });
  }

  await tx.user.delete({ where: { id: userId } });
});

console.log('Done.');
await prisma.$disconnect();
