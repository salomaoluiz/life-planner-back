import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';
import { QueryCounter } from '@shared/infra/db/QueryCounter';
import { configureApp } from '@shared/infra/http/configure-app';

import { AppModule } from '../src/modules/app.module';
import { assertPerfRunAllowed } from '../scripts/perf/measure/safety';
import { loadRegistry } from '../scripts/perf/registry';
import { ApiClient } from '../scripts/perf/seed/client';
import { measure } from './support/measure';

// Spec 085: statements held under lock by the transaction writes, and 10 parallel writes on one card and one account.
// Exception to spec 093 ("perf tests only read"): it writes only under a throwaway user it signs up itself (never the
// pinned base user, so the dataset fingerprint is untouched) and deletes that user in afterAll.
const FINANCE = '/api/v1/finance';
const BUDGETS = loadRegistry(join(__dirname, 'budgets'), ['finance']).finance;
const maxInTx = (key: string): number => BUDGETS[key].maxQueriesInTx as number;
const MAX_CREATE_TOTAL = 20;
const PARALLEL = 10;
const runsFinance = (process.env.PERF_MODULES ?? '').split(',').includes('finance');
let app: NestExpressApplication;
let client: ApiClient;
let email: string;
let userId: string;
let accountId: string;
let cardId: string;
let categoryId: string;
const today = new Date().toISOString().slice(0, 10);

// The relation read of the response is a join (spec 071); under lock only scalars are selected (spec 085 FR 1).
const joinReads = (statements: string[]): number =>
  statements.filter((sql) => /LATERAL/i.test(sql)).length;
const lockStatements = (statements: string[]): number =>
  statements.filter((sql) => /FOR UPDATE/i.test(sql)).length;

async function balanceOf(): Promise<number> {
  const accounts = await client.get<{ balance: number; id: string }[]>(`${FINANCE}/accounts`);

  return (accounts.find((account) => account.id === accountId) as { balance: number }).balance;
}

function newTransaction(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    categoryId,
    date: today,
    description: `write-perf ${randomUUID()}`,
    owner: 'USER',
    ownerId: userId,
    type: 'EXPENSE',
    value: 1000,
    ...extra,
  };
}

(runsFinance ? describe : describe.skip)('transaction writes under lock (spec 085)', () => {
  beforeAll(async () => {
    assertPerfRunAllowed(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as { port: number };
    client = new ApiClient(`http://127.0.0.1:${port}`);
    email = `write-perf-${randomUUID()}@example.com`;
    const password = `Pw-${randomUUID()}`;
    await client.signup(email, 'Write Perf', password);
    await client.login(email, password);
    userId = (await client.get<{ id: string }>('/api/v1/user/me')).id;
    categoryId = (
      await client.post<{ id: string }>(`${FINANCE}/categories`, {
        icon: 'home',
        name: 'Write perf',
        owner: 'USER',
        ownerId: userId,
        type: 'EXPENSE',
      })
    ).id;
    accountId = (
      await client.post<{ id: string }>(`${FINANCE}/accounts`, {
        icon: 'home',
        initialBalance: 0,
        name: 'Write perf account',
        owner: 'USER',
        ownerId: userId,
      })
    ).id;
    cardId = (
      await client.post<{ id: string }>(`${FINANCE}/credit-cards`, {
        brand: 'VISA',
        closingDay: 10,
        color: '#112233',
        dueDay: 20,
        lastDigits: '1234',
        limit: 100_000_000,
        title: 'Write perf card',
        owner: 'USER',
        ownerId: userId,
      })
    ).id;
    for (const name of ['write-perf-a', 'write-perf-b']) {
      await client.post(`${FINANCE}/tags`, { name, owner: 'USER', ownerId: userId });
    }
    QueryCounter.enable();
  });

  afterAll(async () => {
    QueryCounter.disable();
    await client?.delete('/api/v1/user/me', { email });
    await app?.close();
  });

  it('SHOULD hold at most 15 statements under lock when creating with 2 tags', async () => {
    const { inTx, statements, total } = await measure(() =>
      client.post(
        `${FINANCE}/transactions`,
        newTransaction({ accountId, paid: true, tags: ['write-perf-a', 'write-perf-b'] }),
      ),
    );

    console.info('write-perf create', { inTx, total });
    expect(joinReads(statements)).toBe(0);
    expect(inTx).toBeGreaterThan(0);
    expect(inTx).toBeLessThanOrEqual(maxInTx('POST /api/v1/finance/transactions'));
    expect(total).toBeLessThanOrEqual(MAX_CREATE_TOTAL);
  });

  it('SHOULD hold at most 15 statements under lock when updating', async () => {
    const created = await client.post<{ item: { id: string } }>(
      `${FINANCE}/transactions`,
      newTransaction({ creditCardId: cardId, tags: ['write-perf-a'] }),
    );
    const { inTx, statements } = await measure(() =>
      client.patch(`${FINANCE}/transactions/${created.item.id}`, {
        tags: ['write-perf-b'],
        value: 2000,
      }),
    );

    console.info('write-perf update', { inTx });
    expect(joinReads(statements)).toBe(0);
    expect(lockStatements(statements)).toBe(1);
    expect(inTx).toBeGreaterThan(0);
    expect(inTx).toBeLessThanOrEqual(maxInTx('PATCH /api/v1/finance/transactions/:id'));
  });

  it('SHOULD hold at most 10 statements under lock when deleting', async () => {
    const created = await client.post<{ item: { id: string } }>(
      `${FINANCE}/transactions`,
      newTransaction({ accountId, paid: true }),
    );
    const { inTx, statements } = await measure(() =>
      client.delete(`${FINANCE}/transactions/${created.item.id}`),
    );

    console.info('write-perf delete', { inTx });
    expect(lockStatements(statements)).toBe(1);
    expect(inTx).toBeGreaterThan(0);
    expect(inTx).toBeLessThanOrEqual(maxInTx('DELETE /api/v1/finance/transactions/:id'));
  });

  it('SHOULD take the card lock BEFORE the row lock in the single statement of an update (lock order cards -> row)', async () => {
    const created = await client.post<{ item: { id: string } }>(
      `${FINANCE}/transactions`,
      newTransaction({ creditCardId: cardId }),
    );
    const rowId = created.item.id;
    const db = app.get(Database).client;
    let releaseCard: () => void = () => undefined;
    const cardHeld = new Promise<void>((resolve) => (releaseCard = resolve));
    let cardLocked: () => void = () => undefined;
    const cardIsLocked = new Promise<void>((resolve) => (cardLocked = resolve));
    // Another connection holds the card (as an invoice payment would).
    const holder = db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "financial_credit_cards" WHERE "id" = ${cardId} FOR UPDATE`;
        cardLocked();
        await cardHeld;
      },
      { timeout: 30_000 },
    );
    await cardIsLocked;

    let patched = false;
    const patch = client
      .patch(`${FINANCE}/transactions/${rowId}`, { value: 3000 })
      .then(() => (patched = true));
    await new Promise((resolve) => setTimeout(resolve, 700));

    // The PATCH waits on the card, so it must not hold the row yet: a NOWAIT lock on the row succeeds.
    expect(patched).toBe(false);
    await expect(
      db.$transaction(
        (tx) =>
          tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id" = ${rowId} FOR UPDATE NOWAIT`,
      ),
    ).resolves.toHaveLength(1);

    releaseCard();
    await holder;
    await patch;
    expect(patched).toBe(true);
  });

  it('SHOULD finish 10 parallel creates on one card and one account with the right balance', async () => {
    const before = await balanceOf();
    const started = Date.now();

    await Promise.all([
      ...Array.from({ length: PARALLEL }, () =>
        client.post(
          `${FINANCE}/transactions`,
          newTransaction({ accountId, paid: true, value: 500 }),
        ),
      ),
      ...Array.from({ length: PARALLEL }, () =>
        client.post(
          `${FINANCE}/transactions`,
          newTransaction({ creditCardId: cardId, value: 500 }),
        ),
      ),
    ]);

    console.info('write-concurrency wallMs', Date.now() - started);
    expect(before - (await balanceOf())).toBe(PARALLEL * 500);
  });
});
