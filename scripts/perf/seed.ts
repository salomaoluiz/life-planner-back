import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ApiClient } from './seed/client';
import { hashConfig, SeedManifest, writeManifest } from './seed/manifest';
import { createRng, Rng } from './seed/random';
import { resetPerfAccount } from './seed/reset';
import { assertSeedAllowed, resolveApiUrl, SeedRefusal } from './seed/safety';

export type SeedModule = 'family' | 'finance' | 'stock';
const MODULES: SeedModule[] = ['family', 'stock', 'finance'];

export interface SeedConfig {
  family: { families: number; invitesPerFamily: number };
  finance: Record<string, number>;
  seed: number;
  stock: { items: number };
}

export interface SeedContext {
  cfg: SeedConfig;
  client: ApiClient;
  familyIds: string[];
  rng: Rng;
  today: string;
  userId: string;
}

export interface RunResult {
  counts: Record<string, number>;
  familyIds?: string[];
  referenceMonth?: string;
}

export type Runner = (ctx: SeedContext) => Promise<RunResult>;
export type Runners = Record<SeedModule, Runner>;

export function parseArgs(argv: string[]): { module?: SeedModule; reset: boolean } {
  let module: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--module') module = argv[i + 1];
    else if (argv[i].startsWith('--module=')) module = argv[i].slice('--module='.length);
  }
  if (module !== undefined && !MODULES.includes(module as SeedModule)) {
    throw new SeedRefusal('usage: yarn perf:seed [--module stock|family|finance] [--reset]');
  }

  return { module: module as SeedModule | undefined, reset: argv.includes('--reset') };
}

export function loadConfig(): SeedConfig {
  return JSON.parse(readFileSync(resolve(__dirname, '../../perf/seed.config.json'), 'utf8'));
}

async function login(client: ApiClient, email: string, password: string): Promise<void> {
  try {
    await client.login(email, password);
  } catch {
    await client.signup(email, 'Perf account', password);
    await client.login(email, password);
  }
}

export async function runSeed(
  argv: string[],
  env: NodeJS.ProcessEnv,
  client: ApiClient,
  runners: Runners,
  log: (line: string) => void,
  now: Date = new Date(),
): Promise<SeedManifest> {
  const args = parseArgs(argv);
  assertSeedAllowed(env, resolveApiUrl(env));
  const email = env.PERF_USER_EMAIL;
  const password = env.PERF_USER_PASSWORD;
  if (!email || !password) {
    throw new SeedRefusal('perf seed refused: PERF_USER_EMAIL and PERF_USER_PASSWORD are required');
  }

  const startedAt = Date.now();
  const cfg = loadConfig();
  await login(client, email, password);
  let me = await client.get<{ email: string; id: string }>('/api/v1/user/me');
  if (args.reset) {
    await resetPerfAccount(client, me.email, email, password);
    me = await client.get<{ email: string; id: string }>('/api/v1/user/me');
  }

  const ctx: SeedContext = {
    cfg,
    client,
    familyIds: [],
    rng: createRng(cfg.seed),
    today: now.toISOString().slice(0, 10),
    userId: me.id,
  };
  const wanted = MODULES.filter((name) => !args.module || args.module === name);
  const counts: Record<string, number> = {};
  let referenceMonth = ctx.today.slice(0, 7);

  // Stock and finance need the family ids even when only they run (read only).
  const families = await client.get<{ id: string; name: string }[]>('/api/v1/families');
  ctx.familyIds = families.filter((f) => f.name.startsWith('Perf family ')).map((f) => f.id);

  for (const name of wanted) {
    const result = await runners[name](ctx);
    Object.assign(counts, result.counts);
    if (result.familyIds) ctx.familyIds = result.familyIds;
    if (result.referenceMonth) referenceMonth = result.referenceMonth;
    log(`${name}: ${JSON.stringify(result.counts)}`);
  }

  const manifest: SeedManifest = {
    configHash: hashConfig(cfg),
    counts,
    familyIds: ctx.familyIds,
    referenceMonth,
    seededAt: now.toISOString(),
    userId: me.id,
  };
  log(`done in ${Date.now() - startedAt} ms`);

  return manifest;
}

// Entry: `yarn perf:seed`. Exit 2 = refused, 1 = failed.
export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  try {
    try {
      process.loadEnvFile('.env');
    } catch {
      // No .env file: the variables come from the shell.
    }
    const { createRunners } = await import('./seed/runners');
    const client = new ApiClient(resolveApiUrl(process.env));
    const manifest = await runSeed(argv, process.env, client, createRunners(), console.log);
    writeManifest(resolve(__dirname, '../../perf/seed.manifest.json'), manifest);

    return 0;
  } catch (error) {
    console.error((error as Error).message);

    return error instanceof SeedRefusal ? error.exitCode : 1;
  }
}

if (require.main === module) {
  void main(process.argv.slice(2), process.env).then((code) => process.exit(code));
}
