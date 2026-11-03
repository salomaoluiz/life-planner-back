import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { configureApp } from '@shared/infra/http/configure-app';

import { AppModule } from '../../../src/modules/app.module';
import { verifyDataset } from '../measure/dataset';
import { Fixtures, resolveFixtures } from '../measure/fixtures';
import { DEFAULT_PERF_EMAIL } from '../seed';
import { ApiClient } from '../seed/client';
import type { SeedManifest } from '../seed/manifest';
import { ExplainEntry, runExplain } from './explain';

const ROOT = join(__dirname, '../../..');

// Integration glue (needs the database of .env): exercised through `yarn perf:check`, not unit tests.
export async function bootAndExplain(
  entries: ExplainEntry[],
): Promise<{ key: string; violations: string[] }[]> {
  if (entries.length === 0) return [];
  process.env.PERF_COUNT_QUERIES = '1';
  process.env.SWAGGER_ENABLED = 'false';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  try {
    const { port } = app.getHttpServer().address() as { port: number };
    const baseUrl = `http://127.0.0.1:${port}`;
    const { token } = await loginPerfUser(baseUrl);

    return await runExplain({ baseUrl, entries, token });
  } finally {
    await app.close();
  }
}

export async function loginPerfUser(
  baseUrl: string,
): Promise<{ fixtures: Fixtures; token: string }> {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'perf/seed.manifest.json'), 'utf8'),
  ) as SeedManifest;
  const client = new ApiClient(baseUrl);
  await client.login(
    process.env.PERF_USER_EMAIL || DEFAULT_PERF_EMAIL,
    process.env.PERF_USER_PASSWORD ?? '',
  );

  await verifyDataset(client, manifest);

  return { fixtures: await resolveFixtures(client, manifest), token: client.accessToken ?? '' };
}
