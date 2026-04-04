import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const proc = globalThis.process;
const isWindows = proc.platform === 'win32';
const pnpmBin = isWindows ? 'pnpm.cmd' : 'pnpm';
const backendDir = fileURLToPath(new globalThis.URL('..', import.meta.url));

const testDatabaseUrl =
  proc.env.DATABASE_URL_TEST ??
  proc.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:54329/simulador_api_test?schema=public';

const testEnv = {
  ...proc.env,
  NODE_ENV: 'test',
  RUN_DB_TESTS: 'true',
  OPENAI_API_KEY: proc.env.OPENAI_API_KEY ?? 'test-key',
  OPENAI_MODEL: proc.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  DATABASE_URL: testDatabaseUrl,
};

function runPnpm(args) {
  const result = spawnSync(pnpmBin, args, {
    cwd: backendDir,
    env: testEnv,
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: pnpm ${args.join(' ')}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function migrateWithRetry() {
  const maxAttempts = 15;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = spawnSync(
      pnpmBin,
      ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      {
        cwd: backendDir,
        env: testEnv,
        stdio: 'inherit',
        shell: true,
      }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      return;
    }

    if (attempt === maxAttempts) {
      throw new Error('Could not apply migrations on test database');
    }

    globalThis.console.log(`Retrying migrations (${attempt}/${maxAttempts})...`);
    await sleep(2000);
  }
}

await (async () => {
  runPnpm(['exec', 'prisma', 'generate']);
  await migrateWithRetry();
  runPnpm(['exec', 'vitest', 'run', 'src/__tests__/db.integration.test.ts']);
})();
