import { Inject } from '@nestjs/common';

import { IncomeAccessInput, IncomeAccessSchema } from '@investment/application/dto/Income';
import {
  assertIncomeAccountChangeable,
  loadIncome,
} from '@investment/application/service/IncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 21: removes the income and its finance row (ledger adjusted); its suggestion never comes back.
export class DeleteIncomeUseCase implements UseCaseWithParams<IncomeAccessInput, void> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: IncomeAccessInput): Promise<void> {
    const input = validate(IncomeAccessSchema, params);
    const { income } = await loadIncome(
      this.incomes,
      this.investment,
      input.id,
      input.accessibleOwners,
    );

    await loadWritableAsset(this.investment, income.assetId, input.accessibleOwners);
    await assertIncomeAccountChangeable(this.investment, input.accessibleOwners, income.accountId);
    await this.incomes.deleteIncome(income.id);
  }
}
