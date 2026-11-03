import { FindTransactionsFilter } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { TransactionSource } from '@finance/domain/enum';

import { relationLoadStrategyFor } from './index';

describe('relationLoadStrategyFor', () => {
  const refs = [{ credit_card_id: 'card-1', invoice_month: '2026-10' }];

  it.each<{
    expected: string | undefined;
    filter: FindTransactionsFilter;
    source: 'ACCOUNT' | 'CARD';
  }>([
    { expected: 'join', filter: { from: '2026-10-01', to: '2026-10-31' }, source: 'ACCOUNT' },
    { expected: undefined, filter: { from: '2026-10-01' }, source: 'ACCOUNT' },
    { expected: undefined, filter: { to: '2026-10-31' }, source: 'ACCOUNT' },
    { expected: undefined, filter: {}, source: 'ACCOUNT' },
    { expected: undefined, filter: { invoiceMonth: '2026-10' }, source: 'ACCOUNT' },
    { expected: 'join', filter: { invoiceMonth: '2026-10' }, source: 'CARD' },
    { expected: 'join', filter: { invoiceRefs: refs }, source: 'CARD' },
    { expected: 'join', filter: { invoiceRefs: [] }, source: 'CARD' },
    { expected: undefined, filter: {}, source: 'CARD' },
    { expected: undefined, filter: { from: '2026-10-01', to: '2026-10-31' }, source: 'CARD' },
  ])(
    'SHOULD return $expected WHEN the $source filter is $filter',
    ({ expected, filter, source }) => {
      expect(relationLoadStrategyFor(TransactionSource[source], filter)).toBe(expected);
    },
  );
});
