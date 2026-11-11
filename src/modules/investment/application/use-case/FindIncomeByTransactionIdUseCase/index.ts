import { Inject } from '@nestjs/common';

import { TransactionLinkInput, TransactionLinkSchema } from '@investment/application/dto/Income';
import { IIncomeRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 16: the income behind a locked finance row, so the app can open it.
export class FindIncomeByTransactionIdUseCase implements UseCaseWithParams<
  TransactionLinkInput,
  { assetId: string; incomeId: string } | undefined
> {
  constructor(@Inject('IIncomeRepository') private readonly incomes: IIncomeRepository) {}

  async execute(
    params: TransactionLinkInput,
  ): Promise<{ assetId: string; incomeId: string } | undefined> {
    const input = validate(TransactionLinkSchema, params);

    return this.incomes.findIncomeByTransactionId(input.transactionId);
  }
}
