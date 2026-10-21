import { Inject } from '@nestjs/common';

import {
  CountExportTransactionsInput,
  CountExportTransactionsSchema,
} from '@finance/application/dto/ExportTransactions';
import { resolveExportOwners } from '@finance/application/service/ExportOwners';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// The live count of the export modal (spec 047 FR 2): the same rows the export writes.
export class CountExportTransactionsUseCase implements UseCaseWithParams<
  CountExportTransactionsInput,
  { count: number }
> {
  constructor(
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: CountExportTransactionsInput): Promise<{ count: number }> {
    const input = validate(CountExportTransactionsSchema, params);
    const owners = resolveExportOwners(input.accessibleOwners, input.owner, input.ownerId);

    if (owners.length === 0) {
      return { count: 0 };
    }

    const count = await this.transactionRepository.countTransactionsForExport({
      accountIds: input.accountIds,
      creditCardIds: input.creditCardIds,
      from: input.from,
      owners,
      to: input.to,
    });

    return { count };
  }
}
