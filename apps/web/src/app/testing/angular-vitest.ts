import '@angular/compiler';
import {
  ɵChangeDetectionScheduler as ChangeDetectionScheduler,
  ɵEffectScheduler as EffectScheduler,
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { readFile, readdir } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { afterEach, beforeEach } from 'vitest';

const ANGULAR_TEST_ENV_KEY = '__simulador_api_ia_angular_test_env__';
const ANGULAR_RESOURCES_KEY = '__simulador_api_ia_angular_resources__';
const APP_ROOT = join(process.cwd(), 'src', 'app');

let resourcePathIndexPromise: Promise<Map<string, string>> | null = null;

function ensureAngularTestEnvironment(): void {
  const state = globalThis as typeof globalThis & Record<string, boolean | undefined>;

  if (state[ANGULAR_TEST_ENV_KEY]) return;

  try {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
      teardown: { destroyAfterEach: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Cannot set base providers because it has already been called')) throw error;
  }

  state[ANGULAR_TEST_ENV_KEY] = true;
}

export function setupAngularVitest(): void {
  ensureAngularTestEnvironment();

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });
}

export function provideAngularEffectScheduler() {
  return {
    provide: ChangeDetectionScheduler,
    useValue: { notify() {}, runningTick: false },
  };
}

export function provideAngularReactiveSchedulers() {
  return [
    provideAngularEffectScheduler(),
    {
      provide: EffectScheduler,
      useValue: {
        add() {},
        schedule() {},
        flush() {},
        remove() {},
      },
    },
  ];
}

async function indexResourcePaths(rootPath: string): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const entries = await readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = `${rootPath}/${entry.name}`;

    if (entry.isDirectory()) {
      const nestedIndex = await indexResourcePaths(entryPath);
      for (const [key, value] of nestedIndex) index.set(key, value);
      continue;
    }

    index.set(entry.name, entryPath);
  }

  return index;
}

async function getResourcePathIndex(): Promise<Map<string, string>> {
  resourcePathIndexPromise ??= indexResourcePaths(APP_ROOT);
  return resourcePathIndexPromise;
}

async function resolveAngularResourcePath(url: string): Promise<string | URL> {
  if (url.startsWith('file:')) return new URL(url);
  if (isAbsolute(url)) return url;

  const resourcePath = (await getResourcePathIndex()).get(basename(url));

  if (!resourcePath) {
    throw new Error(`Could not resolve Angular external resource: ${url}`);
  }

  return resourcePath;
}

export async function resolveAngularExternalResources(): Promise<void> {
  const state = globalThis as typeof globalThis & Record<string, boolean | undefined>;

  if (state[ANGULAR_RESOURCES_KEY]) return;

  await resolveComponentResources(async (url) => readFile(await resolveAngularResourcePath(url), 'utf8'));
  state[ANGULAR_RESOURCES_KEY] = true;
}
