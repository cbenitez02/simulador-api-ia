import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  currentDir,
  '../../../prisma/migrations/20260410173000_auth_schema_ownership/migration.sql'
);

describe('auth schema ownership migration', () => {
  it('define tablas de ownership y backfill legacy para Project.workspaceId', async () => {
    const migrationSql = await readFile(migrationPath, 'utf8');

    expect(migrationSql).toContain('CREATE TABLE "User"');
    expect(migrationSql).toContain('CREATE TABLE "Workspace"');
    expect(migrationSql).toContain('CREATE TABLE "WorkspaceMembership"');
    expect(migrationSql).toContain('CREATE TABLE "ExternalIdentity"');
    expect(migrationSql).toContain('ALTER TABLE "Project" ADD COLUMN "workspaceId" TEXT;');
    expect(migrationSql).toContain('INSERT INTO "Workspace"');
    expect(migrationSql).toContain('UPDATE "Project"');
    expect(migrationSql).toContain('FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")');
  });
});
