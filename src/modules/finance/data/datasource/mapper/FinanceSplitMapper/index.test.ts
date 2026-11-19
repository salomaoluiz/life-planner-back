import { mocks as transactionMocks } from '@finance/data/datasource/mapper/FinanceTransactionMapper/index.mocks';
import { TransactionType } from '@finance/domain/enum';

import { FinanceSplitMapper } from './index';

const record = {
  account_id: 'acc-1',
  created_at: new Date('2026-11-15T10:00:00.000Z'),
  created_by: 'user-1',
  credit_card_id: null,
  currency: 'BRL',
  date: new Date('2026-11-15T00:00:00.000Z'),
  description: 'Mercado',
  id: 'split-1',
  invoice_month: null,
  notes: 'Compra',
  occurrence_number: null,
  owner: 'USER',
  owner_id: 'user-1',
  paid: true,
  recurrence_id: null,
  transactions: [
    { ...transactionMocks.raw, id: 'p1', split_id: 'split-1', type: 'EXPENSE', value: 12000 },
    { ...transactionMocks.raw, id: 'p2', split_id: 'split-1', type: 'EXPENSE', value: -440 },
  ],
  updated_at: new Date('2026-11-15T10:00:00.000Z'),
};

it('SHOULD map the header AND its parts, with the date as YYYY-MM-DD AND the derived total', () => {
  const split = FinanceSplitMapper.toDomain(record as never);

  expect(split).toEqual(
    expect.objectContaining({
      accountId: 'acc-1',
      creditCardId: null,
      date: '2026-11-15',
      description: 'Mercado',
      id: 'split-1',
      notes: 'Compra',
      paid: true,
      recurrenceId: null,
      total: 11560,
      type: TransactionType.EXPENSE,
    }),
  );
  expect(split.parts.map((part) => part.id)).toEqual(['p1', 'p2']);
  expect(split.parts[0].splitId).toBe('split-1');
});
