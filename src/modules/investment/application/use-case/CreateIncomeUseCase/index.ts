import { Inject } from '@nestjs/common';

import { CreateIncomeInput, CreateIncomeSchema } from '@investment/application/dto/Income';
import { IncomeView, persistIncome } from '@investment/application/service/IncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 3-5, 11, 15, 19: an income of the asset with its finance row, planned or received.
export class CreateIncomeUseCase implements UseCaseWithParams<CreateIncomeInput, IncomeView> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: CreateIncomeInput): Promise<IncomeView> {
    const input = validate(CreateIncomeSchema, params);
    const asset = await loadWritableAsset(this.investment, input.assetId, input.accessibleOwners);

    return persistIncome(this.incomes, this.investment, input.accessibleOwners, asset, {
      accountId: input.accountId,
      amountPerUnit: input.amountPerUnit ?? null,
      categoryId: input.categoryId,
      createdBy: input.userId,
      exDate: input.exDate ?? null,
      netAmount: input.netAmount,
      notes: input.notes,
      paymentDate: input.paymentDate,
      quantity: input.quantity ?? null,
      status: input.status,
      type: input.type,
    });
  }
}
