import { Prisma } from '@db/client';
import { FindTransactionsFilter } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { TransactionSource } from '@finance/domain/enum';

// 'join' answers a bounded list (a period, an invoice) in ONE statement. Postgres then builds the JSON of every row,
// which costs more database CPU than the per-relation queries on a whole history (~245 ms per call, 12 concurrent
// calls 2,420 → 5,136 ms), so the unbounded list keeps the default strategy.
export function relationLoadStrategyFor(
  source: TransactionSource,
  filter: FindTransactionsFilter,
): Prisma.RelationLoadStrategy {
  const bounded =
    source === TransactionSource.CARD
      ? filter.invoiceMonth !== undefined || filter.invoiceRefs !== undefined
      : Boolean(filter.from && filter.to);

  return bounded ? 'join' : 'query';
}
