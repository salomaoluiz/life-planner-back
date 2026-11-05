import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { configureApp } from '@shared/infra/http/configure-app';

import { AppModule } from '../src/modules/app.module';
import { PERF_MODULES, PerfModule } from '../scripts/perf/modules';
import { loadRegistry, parseRegistryKey } from '../scripts/perf/registry';
import { DEFAULT_PERF_EMAIL } from '../scripts/perf/seed';
import { ApiClient } from '../scripts/perf/seed/client';
import type { SeedManifest } from '../scripts/perf/seed/manifest';
import { verifyDataset } from '../scripts/perf/measure/dataset';
import {
  expandPath,
  expandScenario,
  Fixtures,
  resolveFixtures,
} from '../scripts/perf/measure/fixtures';
import { applyBaseline, measureRequest } from '../scripts/perf/measure/runner';
import { assertPerfRunAllowed } from '../scripts/perf/measure/safety';
import { renderSummary, SummaryRow } from '../scripts/perf/measure/summary';

const ROOT = join(__dirname, '..');
const BUDGETS = join(__dirname, 'budgets');
const UPDATE = process.env.PERF_UPDATE_BASELINE === '1';
const requested = (process.env.PERF_MODULES ?? '').split(',').filter(Boolean);
const modules = PERF_MODULES.filter((name) => requested.includes(name));
const registry = loadRegistry(BUDGETS, modules);

const rows: SummaryRow[] = [];
const measuredByModule = new Map<PerfModule, Record<string, number>>();
let app: NestExpressApplication;
let baseUrl: string;
let client: ApiClient;
let fx: Fixtures;

beforeAll(async () => {
  assertPerfRunAllowed(process.env);
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'perf/seed.manifest.json'), 'utf8'),
  ) as SeedManifest;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
  client = new ApiClient(baseUrl);
  await client.login(
    process.env.PERF_USER_EMAIL || DEFAULT_PERF_EMAIL,
    process.env.PERF_USER_PASSWORD ?? '',
  );
  await verifyDataset(client, manifest);
  fx = await resolveFixtures(client, manifest);
});

afterAll(async () => {
  if (UPDATE) {
    for (const [name, measured] of measuredByModule) {
      applyBaseline(join(BUDGETS, `${name}.json`), measured);
    }
  }
  mkdirSync(join(ROOT, 'perf-report'), { recursive: true });
  writeFileSync(join(ROOT, 'perf-report/summary.md'), renderSummary(rows));
  await app?.close();
});

for (const name of modules) {
  describe(name, () => {
    for (const [key, entry] of Object.entries(registry[name])) {
      if (entry.kind === 'unmeasured') {
        rows.push({ budget: entry.maxQueries, key, measured: 0, module: name, status: 'skipped' });
        continue;
      }

      it(`SHOULD stay within ${entry.maxQueries} queries: ${key}`, async () => {
        const { method, template } = parseRegistryKey(key);
        const path = expandPath(template, entry.params ?? {}, fx);
        const query = expandScenario(entry.scenario, fx);
        const request = { method, path: query ? `${path}?${query}` : path };
        let measured = -1;
        try {
          ({ measured } = await measureRequest({
            baseUrl,
            key,
            request,
            revalidate: entry.revalidate,
            token: client.accessToken ?? '',
          }));
        } finally {
          rows.push({
            budget: entry.maxQueries,
            key,
            measured,
            module: name,
            status: UPDATE || (measured >= 0 && measured <= entry.maxQueries) ? 'ok' : 'fail',
          });
        }
        measuredByModule.set(name, { ...measuredByModule.get(name), [key]: measured });

        if (!UPDATE) expect(measured).toBeLessThanOrEqual(entry.maxQueries);
      });
    }
  });
}
