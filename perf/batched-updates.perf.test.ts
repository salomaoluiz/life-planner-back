import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { Database } from '@shared/infra/db/Database';
import { QueryCounter } from '@shared/infra/db/QueryCounter';
import { configureApp } from '@shared/infra/http/configure-app';

import { AppModule } from '../src/modules/app.module';
import { assertPerfRunAllowed } from '../scripts/perf/measure/safety';
import { loadRegistry } from '../scripts/perf/registry';
import { ApiClient } from '../scripts/perf/seed/client';
import { measure } from './support/measure';

// Spec 086: row updates go out as one `UPDATE ... FROM (VALUES ...)` per chunk instead of one per row.
// Exception to spec 093 ("perf tests only read"): it writes only under a throwaway user it signs up itself (never the
// pinned base user, so the dataset fingerprint is untouched) and deletes that user in afterAll.
const FINANCE = '/api/v1/finance';
const BUDGETS = loadRegistry(join(__dirname, 'budgets'), ['finance']).finance;
const maxInTx = (key: string): number => BUDGETS[key].maxQueriesInTx as number;
const MAX_ROW_UPDATES = 3;
const OCCURRENCES = 60;
const runsFinance = (process.env.PERF_MODULES ?? '').split(',').includes('finance');
let app: NestExpressApplication;
let client: ApiClient;
let email: string;
let userId: string;
let categoryId: string;
const now = new Date();
const today = now.toISOString().slice(0, 10);

const rowUpdates = (statements: string[]): number =>
  statements.filter((sql) => /^\s*UPDATE\s+("public"\.)?"financial_transactions"/i.test(sql))
    .length;
const dateOf = (monthsAgo: number, day: number): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day))
    .toISOString()
    .slice(0, 10);

function createCard(title: string, closingDay: number): Promise<{ id: string }> {
  return client.post<{ id: string }>(`${FINANCE}/credit-cards`, {
    brand: 'VISA',
    closingDay,
    color: '#112233',
    dueDay: 25,
    lastDigits: '1234',
    limit: 100_000_000,
    owner: 'USER',
    ownerId: userId,
    title,
  });
}

(runsFinance ? describe : describe.skip)('batched row updates (spec 086)', () => {
  beforeAll(async () => {
    assertPerfRunAllowed(process.env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as { port: number };
    client = new ApiClient(`http://127.0.0.1:${port}`);
    email = `batch-perf-${randomUUID()}@example.com`;
    const password = `Pw-${randomUUID()}`;
    await client.signup(email, 'Batch Perf', password);
    await client.login(email, password);
    userId = (await client.get<{ id: string }>('/api/v1/user/me')).id;
    categoryId = (
      await client.post<{ id: string }>(`${FINANCE}/categories`, {
        icon: 'home',
        name: 'Batch perf',
        owner: 'USER',
        ownerId: userId,
        type: 'EXPENSE',
      })
    ).id;
    QueryCounter.enable();
  });

  afterAll(async () => {
    QueryCounter.disable();
    await client?.delete('/api/v1/user/me', { email });
    await app?.close();
  });

  it(`SHOULD move the invoice months of a ${OCCURRENCES}-occurrence series with at most ${MAX_ROW_UPDATES} row updates`, async () => {
    const from = await createCard('Batch perf from', 10);
    const to = await createCard('Batch perf to', 20);
    const { recurrence: series } = await client.post<{ recurrence: { id: string } }>(
      `${FINANCE}/recurrences`,
      {
        categoryId,
        creditCardId: from.id,
        date: dateOf(OCCURRENCES - 1, 15),
        description: `batch-perf ${randomUUID()}`,
        frequency: 'MONTHLY',
        owner: 'USER',
        ownerId: userId,
        type: 'EXPENSE',
        value: 1000,
      },
    );
    const db = app.get(Database).client;
    const count = await db.financialTransaction.count({ where: { recurrence_id: series.id } });

    expect(count).toBeGreaterThanOrEqual(OCCURRENCES);

    const { inTx, statements } = await measure(() =>
      client.post(`${FINANCE}/recurrences/${series.id}/split`, {
        creditCardId: to.id,
        occurrenceNumber: 1,
      }),
    );
    const rows = await db.financialTransaction.findMany({
      select: { credit_card_id: true, date: true, invoice_month: true },
      where: { credit_card_id: to.id },
    });

    console.info('batch-perf series split', { inTx, rowUpdates: rowUpdates(statements) });
    expect(rowUpdates(statements)).toBeLessThanOrEqual(MAX_ROW_UPDATES);
    expect(inTx).toBeLessThanOrEqual(maxInTx('POST /api/v1/finance/recurrences/:id/split'));
    expect(rows.length).toBeGreaterThanOrEqual(OCCURRENCES);
    for (const row of rows) {
      expect(row.invoice_month).toBe(invoiceMonthOf(row.date.toISOString().slice(0, 10), 20));
    }
  });

  it('SHOULD move 12 open months of purchases with ONE row update when the closing day changes', async () => {
    const card = await createCard('Batch perf closing', 10);

    for (let month = 0; month < 12; month++) {
      await client.post(`${FINANCE}/transactions`, {
        categoryId,
        creditCardId: card.id,
        date: dateOf(month, 15),
        description: `batch-perf closing ${month}`,
        owner: 'USER',
        ownerId: userId,
        type: 'EXPENSE',
        value: 1000,
      });
    }

    const { inTx, statements } = await measure(() =>
      client.patch(`${FINANCE}/credit-cards/${card.id}`, { closingDay: 20 }),
    );
    const rows = await app.get(Database).client.financialTransaction.findMany({
      select: { date: true, invoice_month: true },
      where: { credit_card_id: card.id },
    });

    console.info('batch-perf closing day', { inTx, rowUpdates: rowUpdates(statements) });
    expect(rowUpdates(statements)).toBe(1);
    expect(inTx).toBeLessThanOrEqual(maxInTx('PATCH /api/v1/finance/credit-cards/:id'));
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      expect(row.invoice_month).toBe(invoiceMonthOf(row.date.toISOString().slice(0, 10), 20));
    }
  });

  it('SHOULD restore the installments of a prepaid plan with ONE row update', async () => {
    const card = await createCard('Batch perf prepayment', 10);
    const { plan } = await client.post<{ plan: { id: string } }>(`${FINANCE}/installment-plans`, {
      categoryId,
      creditCardId: card.id,
      date: today,
      description: `batch-perf plan ${randomUUID()}`,
      installments: 12,
      owner: 'USER',
      ownerId: userId,
      today,
      value: 120_000,
    });
    const first = invoiceMonthOf(today, 10);
    const db = app.get(Database).client;
    const original = await db.financialTransaction.findMany({
      orderBy: { installment_number: 'asc' },
      select: { id: true, invoice_month: true },
      where: { installment_plan_id: plan.id },
    });

    await client.post(`${FINANCE}/installment-plans/${plan.id}/prepayment`, {
      date: today,
      targetInvoiceMonth: first,
      today,
    });

    const { inTx, statements } = await measure(() =>
      client.delete(`${FINANCE}/installment-plans/${plan.id}/prepayment`),
    );
    const restored = await db.financialTransaction.findMany({
      orderBy: { installment_number: 'asc' },
      select: { id: true, invoice_month: true },
      where: { installment_plan_id: plan.id },
    });

    console.info('batch-perf prepayment undo', { inTx, rowUpdates: rowUpdates(statements) });
    expect(rowUpdates(statements)).toBe(1);
    expect(inTx).toBeLessThanOrEqual(
      maxInTx('DELETE /api/v1/finance/installment-plans/:id/prepayment'),
    );
    expect(restored).toEqual(original);
  });
});
