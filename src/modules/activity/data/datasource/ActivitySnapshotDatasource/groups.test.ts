import { ActivityGroupKind } from '@activity/domain/enum';
import { Database } from '@shared/infra/db/Database';

import { ActivitySnapshotDatasource } from './index';

const date = new Date('2026-10-01T00:00:00.000Z');
const tx = {
  account: { name: 'Conta' },
  credit_card: null,
  currency: 'BRL',
  date,
  description: 'Aluguel',
  id: 't-1',
  type: 'EXPENSE',
  value: 100,
};
const client = {
  financialCategory: { findMany: jest.fn(), findUnique: jest.fn() },
  financialSplit: { findMany: jest.fn() },
  financialTransaction: { findMany: jest.fn() },
  financialTransfer: { findMany: jest.fn() },
  investmentIncome: { findMany: jest.fn() },
  investmentOperation: { findMany: jest.fn() },
};
const setup = new ActivitySnapshotDatasource({ client } as unknown as Database);

beforeEach(() => {
  jest.resetAllMocks();
  client.financialTransaction.findMany.mockResolvedValue([tx]);
});

describe('readGroup', () => {
  it('SHOULD read the rows of a plan, a prepayment AND a split as signed transactions', async () => {
    for (const kind of [
      ActivityGroupKind.INSTALLMENT_PLAN_ROWS,
      ActivityGroupKind.PREPAYMENT_ROWS,
      ActivityGroupKind.SPLIT_ROWS,
    ]) {
      await expect(setup.readGroup(kind, 'x')).resolves.toEqual([
        expect.objectContaining({
          amountCents: -100,
          bookingDate: '2026-10-01',
          entityId: 't-1',
          entityType: 'TRANSACTION',
          sourceName: 'Conta',
        }),
      ]);
    }
  });

  it('SHOULD read transactions, transfers AND splits of a recurrence', async () => {
    client.financialTransfer.findMany.mockResolvedValue([
      {
        amount_out: 50,
        currency_out: 'BRL',
        date_out: date,
        description: 'Poupar',
        from_account: { name: 'Conta' },
        id: 'tr-1',
      },
    ]);
    client.financialSplit.findMany.mockResolvedValue([
      {
        account: null,
        credit_card: { title: 'Cartão' },
        currency: 'BRL',
        date,
        description: 'Racha',
        id: 's-1',
        transactions: [tx],
      },
    ]);

    const rows = await setup.readGroup(ActivityGroupKind.RECURRENCE_ROWS, 'r-1');

    expect(rows.map((row) => row.entityType)).toEqual(['TRANSACTION', 'TRANSFER', 'SPLIT']);
    expect(rows[2]).toMatchObject({ amountCents: -100, sourceName: 'Cartão' });
  });

  it('SHOULD read the descendants of a category with a signature of their appearance', async () => {
    client.financialCategory.findMany.mockResolvedValue([
      { icon: 'a', icon_color: 'red', id: 'c-2', name: 'Luz', status: 'ARCHIVED' },
    ]);

    const rows = await setup.readGroup(ActivityGroupKind.CATEGORY_SUBTREE, 'c-1');

    expect(rows.map((row) => [row.label, row.signature])).toEqual([['Luz', 'ARCHIVED:red:a']]);
    client.financialCategory.findMany.mockResolvedValue([]);
    await expect(setup.readGroup(ActivityGroupKind.CATEGORY_SUBTREE, 'leaf')).resolves.toEqual([]);
  });

  it('SHOULD read what a CSV import created for the owner since the request started', async () => {
    client.financialSplit.findMany.mockResolvedValue([]);

    const rows = await setup.readGroup(
      ActivityGroupKind.CREATED_SINCE,
      'USER|u-1|2026-11-27T12:00:00.000Z',
    );

    expect(rows).toHaveLength(1);
    expect(client.financialTransaction.findMany.mock.calls[0][0].where).toEqual({
      created_at: { gte: new Date('2026-11-27T12:00:00.000Z') },
      owner: 'USER',
      owner_id: 'u-1',
      split_id: null,
      transfer_id: null,
    });
  });

  it('SHOULD read the incomes of a series AND the operations of a conversion', async () => {
    client.investmentIncome.findMany.mockResolvedValue([
      {
        asset: { name: 'Petrobras', ticker: 'PETR4' },
        currency: 'BRL',
        id: 'i-1',
        net_amount: 800,
        payment_date: date,
        received: true,
      },
    ]);
    client.investmentOperation.findMany.mockResolvedValue([
      {
        asset: { currency: 'BRL', name: 'Petrobras', ticker: null },
        date,
        id: 'o-1',
        total: 3000,
        type: 'CONVERSION_OUT',
      },
    ]);

    await expect(setup.readGroup(ActivityGroupKind.INCOME_SERIES_ROWS, 's')).resolves.toEqual([
      expect.objectContaining({ entityType: 'INCOME', label: 'PETR4', signature: 'true' }),
    ]);
    await expect(setup.readGroup(ActivityGroupKind.CONVERSION_ROWS, 'c')).resolves.toEqual([
      expect.objectContaining({ entityType: 'OPERATION', label: 'CONVERSION_OUT Petrobras' }),
    ]);
  });

  it('SHOULD read imported transactions by id AND nothing for an empty list', async () => {
    await setup.readGroup(ActivityGroupKind.TRANSACTION_IDS, 'a,b');

    expect(client.financialTransaction.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['a', 'b'] },
    });
    await expect(setup.readGroup(ActivityGroupKind.TRANSACTION_IDS, '')).resolves.toEqual([]);
  });
});
