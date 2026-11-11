import { Inject } from '@nestjs/common';

import {
  GetIncomeDefaultsInput,
  GetIncomeDefaultsSchema,
} from '@investment/application/dto/Income';
import {
  IncomeDefaults,
  loadReadableAsset,
  resolveIncomeDefaults,
} from '@investment/application/service/IncomeRules';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 7-9: account, category, quantity and withholding rate in one read, so the form opens with them.
export class GetIncomeDefaultsUseCase implements UseCaseWithParams<
  GetIncomeDefaultsInput,
  IncomeDefaults
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: GetIncomeDefaultsInput): Promise<IncomeDefaults> {
    const input = validate(GetIncomeDefaultsSchema, params);
    const asset = await loadReadableAsset(this.investment, input.assetId, input.accessibleOwners);

    return resolveIncomeDefaults(this.incomes, this.investment, input.accessibleOwners, asset, {
      exDate: input.exDate,
      type: input.type,
    });
  }
}
