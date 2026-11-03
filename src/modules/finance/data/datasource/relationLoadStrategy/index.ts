import { Prisma } from '@db/client';
import { FindTransactionsFilter } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { TransactionSource } from '@finance/domain/enum';

// A bounded list (a period, an invoice) pins 'join': ONE statement, whatever Prisma's default is. The unbounded list
// (a whole history) leaves the strategy unset: forcing per-relation queries there raised its p50 from 624 to 788 ms
// (Prisma 7's default is already 'join'), and spec 078 removes that list.
export function relationLoadStrategyFor(
  source: TransactionSource,
  filter: FindTransactionsFilter,
): Prisma.RelationLoadStrategy | undefined {
  const bounded =
    source === TransactionSource.CARD
      ? filter.invoiceMonth !== undefined || filter.invoiceRefs !== undefined
      : Boolean(filter.from && filter.to);

  return bounded ? 'join' : undefined;
}
