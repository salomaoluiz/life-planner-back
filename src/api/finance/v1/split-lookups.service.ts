import { Injectable } from '@nestjs/common';

import { TransactionLookups } from '@api/finance/v1/dto/transaction.dto';
import { GetSplitLookupsUseCase } from '@finance/application/use-case/GetSplitLookupsUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { netOf } from '@finance/domain/service/SplitRules';

// Spec 119 FR 27-28: adds `lookups.splits` for the rows that are parts of a split. One extra read, and only when the
// page has a split row, so lists without splits keep their budget. `matched*` count the rows returned for the split:
// the page never cuts a split (FR 30) and the request filters already chose which parts come back.
@Injectable()
export class SplitLookupsService {
  constructor(private readonly getSplitLookupsUseCase: GetSplitLookupsUseCase) {}

  async attach(
    accessibleOwners: OwnerAccess[],
    rows: TransactionEntity[],
    lookups: TransactionLookups,
  ): Promise<TransactionLookups> {
    const splitIds = rows.map((row) => row.splitId).filter((id): id is string => id !== null);

    if (splitIds.length === 0) {
      return lookups;
    }

    const summaries = await this.getSplitLookupsUseCase.execute({ accessibleOwners, splitIds });

    return {
      ...lookups,
      splits: Object.fromEntries(
        summaries.map((summary) => {
          const matched = rows.filter((row) => row.splitId === summary.id);

          return [
            summary.id,
            {
              description: summary.description,
              matchedCount: matched.length,
              matchedTotal: Math.abs(netOf(matched)),
              notes: summary.notes ?? undefined,
              occurrenceNumber: summary.occurrenceNumber ?? undefined,
              paid: summary.paid ?? undefined,
              partCount: summary.partCount,
              recurrenceId: summary.recurrenceId ?? undefined,
              stockPurchaseId: summary.stockPurchaseId ?? undefined,
              total: summary.total,
              type: summary.type,
            },
          ];
        }),
      ),
    };
  }
}
