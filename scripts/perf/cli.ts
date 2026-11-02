import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  manifestStatus,
  assertPerfRunAllowed,
  seedModuleFor,
  SeedModuleName,
} from './measure/safety';
import { PERF_MODULES, PerfModule, selectModules } from './modules';
import { loadConfig } from './seed';
import { hashConfig, SeedManifest } from './seed/manifest';

const USAGE =
  'usage: yarn perf (--changed | --all | --module <family|finance|health|stock|user|version>) [--dry-run] [--update-baseline]';
const ROOT = resolve(__dirname, '../..');

export interface CliArgs {
  all: boolean;
  changed: boolean;
  dryRun: boolean;
  module?: PerfModule;
  updateBaseline: boolean;
}

export interface CliDeps {
  changed(): string[];
  configHash(): string;
  log(line: string): void;
  readManifest(): SeedManifest | undefined;
  runJest(env: Record<string, string>): number;
  runSeed(module: SeedModuleName | undefined): number;
  summaryVerdict(): string | undefined;
}

export function changedFiles(run: (command: string) => string): string[] {
  const files = [
    'git diff --name-only origin/main...HEAD',
    'git diff --name-only HEAD',
    'git ls-files --others --exclude-standard',
  ].flatMap((command) => run(command).split('\n'));

  return [...new Set(files.filter((file) => file !== ''))];
}

export async function main(
  argv: string[],
  env: NodeJS.ProcessEnv,
  deps: CliDeps = defaultDeps(),
): Promise<number> {
  let args: CliArgs;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    deps.log((error as Error).message);

    return 2;
  }
  const modules = args.module
    ? [args.module]
    : args.all
      ? [...PERF_MODULES]
      : selectModules(deps.changed());
  deps.log(`perf modules: ${modules.length > 0 ? modules.join(', ') : 'none'}`);
  if (args.dryRun || modules.length === 0) return 0;

  try {
    assertPerfRunAllowed(env);
  } catch (error) {
    deps.log((error as Error).message);

    return 2;
  }

  // The runner needs the manifest (user id, reference month); the seed fills what is missing or stale.
  const hash = deps.configHash();
  if (!deps.readManifest()) deps.runSeed(undefined);
  const seeded = new Set<SeedModuleName>();
  for (const name of modules) {
    const seedModule = seedModuleFor(name);
    if (
      seedModule &&
      !seeded.has(seedModule) &&
      manifestStatus(deps.readManifest(), hash, name) !== 'ok'
    ) {
      seeded.add(seedModule);
      deps.runSeed(seedModule);
    }
  }

  const code = deps.runJest({
    PERF_MODULES: modules.join(','),
    ...(args.updateBaseline ? { PERF_UPDATE_BASELINE: '1' } : {}),
  });
  const verdict = deps.summaryVerdict();
  if (verdict) deps.log(verdict);

  return code;
}

export function parseCliArgs(argv: string[]): CliArgs {
  let module: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--module') module = argv[i + 1];
    else if (argv[i].startsWith('--module=')) module = argv[i].slice('--module='.length);
  }
  const known = ['--all', '--changed', '--dry-run', '--module', '--update-baseline'];
  const unknown = argv.filter(
    (arg, i) =>
      arg.startsWith('--') && !known.includes(arg.split('=')[0]) && argv[i - 1] !== '--module',
  );
  const all = argv.includes('--all');
  const changed = argv.includes('--changed');
  const valid = module === undefined || PERF_MODULES.includes(module as PerfModule);
  const choices = [all, changed, module !== undefined].filter(Boolean).length;
  if (unknown.length > 0 || !valid || choices !== 1) throw new Error(USAGE);

  return {
    all,
    changed,
    dryRun: argv.includes('--dry-run'),
    ...(module ? { module: module as PerfModule } : {}),
    updateBaseline: argv.includes('--update-baseline'),
  };
}

function defaultDeps(): CliDeps {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: the variables come from the shell.
  }

  return {
    changed: () => changedFiles((command) => execSync(command, { cwd: ROOT, encoding: 'utf8' })),
    configHash: () => hashConfig(loadConfig()),
    log: (line) => console.log(line),
    readManifest: () => {
      try {
        return JSON.parse(readFileSync(resolve(ROOT, 'perf/seed.manifest.json'), 'utf8'));
      } catch {
        return undefined;
      }
    },
    runJest: (extraEnv) =>
      spawnSync(
        process.execPath,
        [resolve(ROOT, 'node_modules/.bin/jest'), '--config', 'perf/jest.perf.config.ts'],
        { cwd: ROOT, env: { ...process.env, ...extraEnv }, stdio: 'inherit' },
      ).status ?? 1,
    runSeed: (module) =>
      spawnSync('yarn', ['perf:seed', ...(module ? ['--module', module] : [])], {
        cwd: ROOT,
        env: process.env,
        stdio: 'inherit',
      }).status ?? 1,
    summaryVerdict: () => {
      try {
        const lines = readFileSync(resolve(ROOT, 'perf-report/summary.md'), 'utf8')
          .trim()
          .split('\n');
        const start = lines.findIndex((line) => line.startsWith('PERF '));

        return start === -1 ? undefined : lines.slice(start).join('\n');
      } catch {
        return undefined;
      }
    },
  };
}

if (require.main === module) {
  void main(process.argv.slice(2), process.env).then((code) => process.exit(code));
}
