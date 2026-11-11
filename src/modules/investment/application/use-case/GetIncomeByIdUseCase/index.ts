import { Inject } from '@nestjs/common';

import { IncomeAccessInput, IncomeAccessSchema } from '@investment/application/dto/Income';
import { IncomeView, loadIncome, toIncomeView } from '@investment/application/service/IncomeRules';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 section 4: anyone who can read the asset reads its incomes (the account may stay out of reach).
export class GetIncomeByIdUseCase implements UseCaseWithParams<IncomeAccessInput, IncomeView> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: IncomeAccessInput): Promise<IncomeView> {
    const input = validate(IncomeAccessSchema, params);
    const { income } = await loadIncome(
      this.incomes,
      this.investment,
      input.id,
      input.accessibleOwners,
    );

    return toIncomeView(income);
  }
}
