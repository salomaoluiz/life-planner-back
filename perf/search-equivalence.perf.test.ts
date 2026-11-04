import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { collectDescendants } from '@finance/domain/service/CategoryTree';
import { normalizeText } from '@finance/domain/service/TextMatch';
import { matchesTransactionQuery } from '@finance/domain/service/TransactionSearch';
import { configureApp } from '@shared/infra/http/configure-app';

import { AppModule } from '../src/modules/app.module';
import { verifyDataset } from '../scripts/perf/measure/dataset';
import { assertPerfRunAllowed } from '../scripts/perf/measure/safety';
import { DEFAULT_PERF_EMAIL } from '../scripts/perf/seed';
import { ApiClient } from '../scripts/perf/seed/client';
import type { SeedManifest } from '../scripts/perf/seed/manifest';

// Spec 084: the SQL search returns exactly the rows the in-memory `matchesTransactionQuery` kept, over the 2-year
// window of the pinned dataset. Part of `yarn perf --module finance`; read-only.
interface Item {
  categoryId: string;
  description: string;
  id: string;
  notes?: string;
  value: number;
}
interface Page {
  items: Item[];
  nextCursor: null | string;
}

const FINANCE = '/api/v1/finance';
const PROBES = [
  'mercado',
  'MERCADO',
  'cafe',
  'café',
  'merc',
  'a',
  '38',
  '38,7',
  '38,70',
  '1.234,50',
  'R$ 38',
  '100%',
  'a_b',
  'perf tx 01',
  'nothing-matches-this',
];
const runsFinance = (process.env.PERF_MODULES ?? '').split(',').includes('finance');
let app: NestExpressApplication;
let client: ApiClient;
let window: string;
let all: Item[];
let categories: { id: string; name: string; parentId?: string }[];

async function readAll(query: string): Promise<Item[]> {
  const rows: Item[] = [];
  let cursor: null | string = null;

  do {
    const page: Page = await client.get<Page>(
      `${FINANCE}/transactions?${window}&limit=500${query}${cursor ? `&cursor=${cursor}` : ''}`,
    );
    rows.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  return rows;
}

function expectedIds(query: string): string[] {
  const needle = normalizeText(query.trim());
  const ids = new Set<string>();

  for (const category of categories) {
    if (normalizeText(category.name).includes(needle)) {
      ids.add(category.id);
      collectDescendants(categories as never, category.id).forEach((child) => ids.add(child.id));
    }
  }

  return all
    .filter((row) =>
      matchesTransactionQuery(
        {
          categoryId: row.categoryId,
          description: row.description,
          notes: row.notes ?? null,
          valueCents: row.value,
        },
        query,
        ids,
      ),
    )
    .map((row) => row.id);
}

(runsFinance ? describe : describe.skip)('transaction search equivalence (spec 084)', () => {
  beforeAll(async () => {
    assertPerfRunAllowed(process.env);
    const manifest = JSON.parse(
      readFileSync(join(__dirname, 'seed.manifest.json'), 'utf8'),
    ) as SeedManifest;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as { port: number };
    client = new ApiClient(`http://127.0.0.1:${port}`);
    await client.login(
      process.env.PERF_USER_EMAIL || DEFAULT_PERF_EMAIL,
      process.env.PERF_USER_PASSWORD ?? '',
    );
    await verifyDataset(client, manifest);
    const [year, month] = manifest.referenceMonth.split('-').map(Number);
    const from = new Date(Date.UTC(year, month - 24, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    window = `from=${from}&to=${to}`;
    all = await readAll('');
    categories = await client.get(`${FINANCE}/categories`);
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(PROBES)('SHOULD return the same rows as the in-memory search for %j', async (probe) => {
    const sql = await readAll(`&q=${encodeURIComponent(probe)}`);

    expect(sql.map((row) => row.id)).toEqual(expectedIds(probe));
  });
});
