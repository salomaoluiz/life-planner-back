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
  transactions: [{ id: 'row-out' }, { id: 'row-in' }],
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
    fromAccountId: 'acc-b',
    rowIds: ['row-out', 'row-in'],
    toAccountId: 'acc-a',
  });
});
