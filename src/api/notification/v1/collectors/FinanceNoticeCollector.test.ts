import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { FinanceNoticeCollector } from './FinanceNoticeCollector';

const accounts = { execute: jest.fn() };
const upcoming = { execute: jest.fn() };
const materialize = { execute: jest.fn() };
const setup = new FinanceNoticeCollector(
  accounts as never,
  upcoming as never,
  materialize as never,
);
const owners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];
const request = { localDate: '2026-11-23', ownerNames: {}, owners };
const base = {
  accountId: 'account-1',
  categoryId: null,
  creditCardId: null,
  currency: 'BRL',
  date: '2026-11-23',
  description: 'Conta de luz',
  id: 'tx-1',
  invoiceMonth: null,
  kind: 'TRANSACTION',
  occurrenceNumber: null,
  owner: OwnerType.USER,
  ownerId: 'user-1',
  purchaseCount: null,
  recurrenceId: null,
  type: TransactionType.EXPENSE,
  valueCents: 21430,
};

beforeEach(() => {
  jest.clearAllMocks();
  accounts.execute.mockResolvedValue([{ id: 'account-1', name: 'Conta corrente' }]);
  upcoming.execute.mockResolvedValue({ next: [], overdue: [] });
});

it('SHOULD materialize recurrences first AND read 30 days with no cut', async () => {
  await setup.collect(request);

  expect(materialize.execute).toHaveBeenCalledWith({
    accessibleOwners: owners,
    today: '2026-11-23',
  });
  expect(upcoming.execute).toHaveBeenCalledWith({
    accessibleOwners: owners,
    days: 30,
    limit: 1000,
    today: '2026-11-23',
  });
  expect(materialize.execute.mock.invocationCallOrder[0]).toBeLessThan(
    upcoming.execute.mock.invocationCallOrder[0],
  );
});

it('SHOULD read nothing WHEN there are no owners', async () => {
  expect(await setup.collect({ ...request, owners: [] })).toEqual([]);
  expect(upcoming.execute).not.toHaveBeenCalled();
});

it('SHOULD turn an unpaid bill into FINANCE_BILL_DUE with the account name AND the transaction route', async () => {
  upcoming.execute.mockResolvedValue({ next: [base], overdue: [] });

  expect(await setup.collect({ ...request, ownerNames: { 'user-1': 'Eu' } })).toEqual([
    {
      dueDate: '2026-11-23',
      module: 'FINANCE',
      owner: OwnerType.USER,
      ownerId: 'user-1',
      route: '/finance/transactions/tx-1',
      snapshot: {
        accountName: 'Conta corrente',
        cardName: undefined,
        currency: 'BRL',
        description: 'Conta de luz',
        ownerName: 'Eu',
        valueCents: 21430,
      },
      sourceId: 'tx-1',
      state: 'DUE_TODAY',
      type: 'FINANCE_BILL_DUE',
    },
  ]);
});

it('SHOULD turn an open invoice into FINANCE_INVOICE_DUE with the invoice route AND the card name', async () => {
  upcoming.execute.mockResolvedValue({
    next: [
      {
        ...base,
        accountId: null,
        creditCardId: 'card-1',
        date: '2026-11-26',
        description: 'Cartão Roxo',
        id: 'card-1:2026-11',
        invoiceMonth: '2026-11',
        kind: 'INVOICE',
      },
    ],
    overdue: [],
  });

  const [item] = await setup.collect(request);

  expect(item).toEqual(
    expect.objectContaining({
      route: '/credit-cards/card-1/invoices/2026-11',
      state: 'UPCOMING',
      type: 'FINANCE_INVOICE_DUE',
    }),
  );
  expect(item.snapshot.cardName).toBe('Cartão Roxo');
});

it('SHOULD route a projection to its occurrence AND classify an overdue bill', async () => {
  upcoming.execute.mockResolvedValue({
    next: [
      {
        ...base,
        date: '2026-11-25',
        id: 'rec-1:4',
        kind: 'PROJECTION',
        occurrenceNumber: 4,
        recurrenceId: 'rec-1',
      },
    ],
    overdue: [{ ...base, date: '2026-11-20', id: 'tx-old' }],
  });

  const items = await setup.collect(request);

  expect(items.map((item) => [item.route, item.state])).toEqual([
    ['/finance/transactions/tx-old', 'OVERDUE'],
    ['/finance/recurrences/rec-1/occurrences/4', 'UPCOMING'],
  ]);
});

it('SHOULD skip income, card rows AND bills more than 30 days late', async () => {
  upcoming.execute.mockResolvedValue({
    next: [
      { ...base, type: TransactionType.INCOME },
      { ...base, creditCardId: 'card-1', id: 'card-row' },
    ],
    overdue: [
      { ...base, date: '2026-10-23', id: 'too-late' },
      { ...base, date: '2026-10-24', id: 'just-in-time' },
    ],
  });

  expect((await setup.collect(request)).map((item) => item.sourceId)).toEqual(['just-in-time']);
});

it('SHOULD not look up accounts for an invoice-only result beyond the empty list', async () => {
  upcoming.execute.mockResolvedValue({ next: [], overdue: [] });

  await setup.collect(request);

  expect(accounts.execute).toHaveBeenCalledWith({ accessibleOwners: owners, ids: [] });
});
