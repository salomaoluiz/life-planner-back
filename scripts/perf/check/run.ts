import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PERF_MODULES, PerfModule } from '../modules';
import { Fixtures, expandPath, expandScenario } from '../measure/fixtures';
import { assertPerfRunAllowed } from '../measure/safety';
import { loadRegistry, parseRegistryKey } from '../registry';
import { loadConcurrency } from './concurrency';
import { ExplainEntry } from './explain';
import { isRegression, checkSize } from './stats';
import { measureConcurrent, measureRoute } from './timing';
import { RunningServer, startServer, waitHealthy } from './server';

const ROOT = resolve(__dirname, '../../..');
const USAGE = 'usage: yarn perf:check [--module <module>] [--update-baseline]';

export interface CheckDeps {
  applyBaseline(
    module: PerfModule,
    updates: Record<string, { maxBytes: number; p50Ms: number }>,
  ): void;
  applyWall(scenario: string, wallMs: number): void;
  build(): number;
  explain(entries: ExplainEntry[]): Promise<{ key: string; violations: string[] }[]>;
  log(line: string): void;
  login(baseUrl: string): Promise<{ fixtures: Fixtures; token: string }>;
  startServer(port: number): RunningServer;
  waitHealthy(baseUrl: string, timeoutMs: number): Promise<void>;
  writeSummary(text: string): void;
}

export function applyCheckBaseline(
  file: string,
  updates: Record<string, { maxBytes: number; p50Ms: number }>,
): void {
  const registry = JSON.parse(readFileSync(file, 'utf8')) as Record<
    string,
    Record<string, unknown>
  >;
  for (const [key, value] of Object.entries(updates)) {
    if (registry[key]) Object.assign(registry[key], value);
  }
  writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`);
}

export async function checkMain(
  argv: string[],
  env: NodeJS.ProcessEnv,
  deps: CheckDeps = defaultDeps(),
): Promise<number> {
  const moduleIndex = argv.indexOf('--module');
  const moduleArg = moduleIndex === -1 ? undefined : argv[moduleIndex + 1];
  const update = argv.includes('--update-baseline');
  const known = argv.filter(
    (arg) => arg.startsWith('--') && !['--module', '--update-baseline'].includes(arg),
  );
  if (
    known.length > 0 ||
    (moduleArg !== undefined && !PERF_MODULES.includes(moduleArg as PerfModule))
  ) {
    deps.log(USAGE);

    return 2;
  }
  const modules = moduleArg ? [moduleArg as PerfModule] : [...PERF_MODULES];

  try {
    assertPerfRunAllowed(env);
  } catch (error) {
    deps.log((error as Error).message);

    return 2;
  }
  if (deps.build() !== 0) {
    deps.log('perf:check could not run: yarn build failed');

    return 2;
  }

  const port = Number(env.PERF_PORT ?? 3999);
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = deps.startServer(port);
  const failures: string[] = [];
  const errors: string[] = [];
  const lines: string[] = [];
  const baselines = new Map<PerfModule, Record<string, { maxBytes: number; p50Ms: number }>>();
  const registry = loadRegistry(join(ROOT, 'perf/budgets'), modules);
  const scenarios = loadConcurrency(join(ROOT, 'perf/concurrency.json'));
  let checked = 0;

  try {
    await deps.waitHealthy(baseUrl, 60_000);
    const { fixtures, token } = await deps.login(baseUrl);

    const pathOf = (name: PerfModule, key: string) => {
      const entry = registry[name][key];
      const { template } = parseRegistryKey(key);
      const path = expandPath(template, entry.params ?? {}, fixtures);
      const query = expandScenario(entry.scenario, fixtures);

      return query ? `${path}?${query}` : path;
    };

    for (const name of modules) {
      for (const [key, entry] of Object.entries(registry[name])) {
        if (entry.kind !== 'read') continue;
        let path: string;
        try {
          path = pathOf(name, key);
        } catch (error) {
          // A fixture the dataset does not have (e.g. an installment plan in the reference month).
          lines.push(`${name} | ${key} | skipped: ${(error as Error).message}`);
          continue;
        }
        let measured: { bytes: number; p50: number };
        try {
          measured = await measureRoute({ baseUrl, key, path, token });
        } catch (error) {
          errors.push(`${key}: ${(error as Error).message}`);
          continue;
        }
        const { bytes, p50 } = measured;
        checked += 1;
        const list = !parseRegistryKey(key).template.includes(':');
        const sizeProblem = checkSize({
          bytes,
          kind: list ? 'list' : 'other',
          knownException: entry.knownException,
          maxBytes: entry.maxBytes,
        });
        const slow = isRegression(p50, entry.p50Ms);
        lines.push(
          `${name} | ${key} | p50 ${Math.round(p50)} ms (base ${entry.p50Ms ?? '-'}) | ${bytes} B`,
        );
        if (slow)
          failures.push(`${key}: p50 ${Math.round(p50)} ms over baseline ${entry.p50Ms} ms`);
        if (sizeProblem) failures.push(`${key}: ${sizeProblem}`);
        baselines.set(name, {
          ...baselines.get(name),
          [key]: { maxBytes: Math.ceil(bytes * 1.1), p50Ms: Math.round(p50) },
        });
      }

      const scenario = scenarios[name];
      if (scenario) {
        const { wallMs } = await measureConcurrent({
          baseUrl,
          calls: scenario.calls.map((key) => ({ path: pathOf(name, key) })),
          repeat: scenario.repeat,
          token,
        });
        checked += 1;
        lines.push(
          `${name} | concurrency x${scenario.repeat} | wall ${Math.round(wallMs)} ms (base ${scenario.wallMs ?? '-'})`,
        );
        if (isRegression(wallMs, scenario.wallMs)) {
          failures.push(
            `${name} concurrency: wall ${Math.round(wallMs)} ms over baseline ${scenario.wallMs} ms`,
          );
        }
        if (update) deps.applyWall(name, Math.round(wallMs));
      }
    }

    await server.stop();

    const entries: ExplainEntry[] = modules.flatMap((name) =>
      Object.entries(registry[name])
        .filter(([, entry]) => entry.kind === 'read' && entry.table && entry.indexes)
        .map(([key, entry]) => ({
          indexes: entry.indexes ?? [],
          key,
          path: pathOf(name, key),
          seqScanException: entry.seqScanException,
          table: entry.table ?? '',
        })),
    );
    for (const result of await deps.explain(entries)) {
      checked += 1;
      for (const violation of result.violations)
        failures.push(`${result.key}: EXPLAIN ${violation}`);
    }
  } catch (error) {
    deps.log(`perf:check could not run: ${(error as Error).message}`);

    return 2;
  } finally {
    await server.stop();
  }

  if (update) {
    for (const [name, updates] of baselines) deps.applyBaseline(name, updates);
  }
  failures.push(...errors);
  const verdict =
    (update && errors.length === 0) || failures.length === 0
      ? `PERF CHECK PASSED: ${checked}/${checked}`
      : `PERF CHECK FAILED: ${failures.length}\n${failures.map((failure) => `- ${failure}`).join('\n')}`;
  deps.writeSummary(`\n${[...lines, '', verdict].join('\n')}\n`);
  deps.log(verdict);

  return (update && errors.length === 0) || failures.length === 0 ? 0 : 1;
}

function defaultDeps(): CheckDeps {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: the variables come from the shell.
  }
  const budgets = (module: PerfModule) => join(ROOT, `perf/budgets/${module}.json`);

  return {
    applyBaseline: (module, updates) => applyCheckBaseline(budgets(module), updates),
    applyWall: (scenario, wallMs) => {
      const file = join(ROOT, 'perf/concurrency.json');
      const data = JSON.parse(readFileSync(file, 'utf8')) as Record<
        string,
        { wallMs: number | null }
      >;
      data[scenario].wallMs = wallMs;
      writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    },
    build: () => spawnSync('yarn', ['build'], { cwd: ROOT, stdio: 'inherit' }).status ?? 1,
    explain: async (entries) => (await import('./explain-boot')).bootAndExplain(entries),
    log: (line) => console.log(line),
    login: async (baseUrl) => {
      // The env is validated when AppModule is imported, so the counter flag must be set before that import.
      // The compiled server was spawned before this point and does not inherit it.
      process.env.PERF_COUNT_QUERIES = '1';
      process.env.SWAGGER_ENABLED = 'false';

      return (await import('./explain-boot')).loginPerfUser(baseUrl);
    },
    startServer: (port) => startServer({ env: process.env, port }),
    waitHealthy: (baseUrl, timeoutMs) => waitHealthy(baseUrl, timeoutMs),
    writeSummary: (text) => {
      mkdirSync(join(ROOT, 'perf-report'), { recursive: true });
      appendFileSync(join(ROOT, 'perf-report/summary.md'), text);
    },
  };
}

if (require.main === module) {
  void checkMain(process.argv.slice(2), process.env).then((code) => process.exit(code));
}
