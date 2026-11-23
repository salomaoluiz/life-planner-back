import { Inject, UnprocessableEntityException } from '@nestjs/common';

import { SplitAccessInput, SplitAccessSchema } from '@finance/application/dto/SplitAccess';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { GetSplitUseCase } from '@finance/application/use-case/GetSplitUseCase';
import { SPLIT_FROM_STOCK_PURCHASE } from '@finance/domain/entity/SystemCategory';
import { IFinanceSplitRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 119 FR 20: removes the header and every part (a paid invoice refuses it in the datasource).
export class DeleteSplitUseCase implements UseCaseWithParams<SplitAccessInput, void> {
  constructor(
    @Inject(GetSplitUseCase)
    private readonly getSplitUseCase: GetSplitUseCase,
    @Inject('IFinanceSplitRepository')
    private readonly splitRepository: IFinanceSplitRepository,
  ) {}

  async execute(params: SplitAccessInput): Promise<void> {
    const input = validate(SplitAccessSchema, params);
    const split = await this.getSplitUseCase.execute(input);

    ensureOwnerWritable(input.accessibleOwners, split);

    // Spec 120 FR 40: a purchase split is deleted through the purchase.
    if (split.stockPurchaseId !== null && !input.fromStockPurchase) {
      throw new UnprocessableEntityException(SPLIT_FROM_STOCK_PURCHASE);
    }

    await this.splitRepository.deleteSplit(split.id);
  }
}
