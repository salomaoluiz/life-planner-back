import { FinanceTransferMapper } from './index';

const record = {
  amount_in: 92000,
  amount_out: 500000,
  created_at: new Date('2026-11-04T10:00:00.000Z'),
  created_by: 'user-1',
  currency_in: 'USD',
  currency_out: 'BRL',
  date_in: new Date('2026-11-06T00:00:00.000Z'),
  date_out: new Date('2026-11-04T00:00:00.000Z'),
  description: 'Send',
  fee: null,
  from_account_id: 'acc-b',
  id: 'transfer-1',
  notes: null,
  occurrence_number: null,
  paid: true,
  recurrence_id: null,
  to_account_id: 'acc-a',
  transactions: [
    { category_id: '00000000-0000-4000-8000-000000000006', id: 'row-out' },
    { category_id: '00000000-0000-4000-8000-000000000007', id: 'row-in' },
    { category_id: '00000000-0000-4000-8000-000000000008', id: 'row-fee' },
  ],
  updated_at: new Date('2026-11-04T10:00:00.000Z'),
};

it('SHOULD map a record to the entity with calendar dates AND row ids', () => {
  const entity = FinanceTransferMapper.toDomain(record);

  expect(entity).toMatchObject({
    amountIn: 92000,
    amountOut: 500000,
    currencyIn: 'USD',
    dateIn: '2026-11-06',
    dateOut: '2026-11-04',
    feeRowId: 'row-fee',
    fromAccountId: 'acc-b',
    rowIds: ['row-out', 'row-in', 'row-fee'],
    toAccountId: 'acc-a',
  });
});
