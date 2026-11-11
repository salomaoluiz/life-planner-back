import { Inject } from '@nestjs/common';

import { UpdateIncomeInput, UpdateIncomeSchema } from '@investment/application/dto/Income';
import {
  assertIncomeAccountChangeable,
  draftFromIncome,
  IncomeView,
  loadIncome,
  persistIncome,
} from '@investment/application/service/IncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 13, 20: every create field can change; a new account moves the row and both ledgers in one transaction.
export class UpdateIncomeUseCase implements UseCaseWithParams<UpdateIncomeInput, IncomeView> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: UpdateIncomeInput): Promise<IncomeView> {
    const input = validate(UpdateIncomeSchema, params);
    const { income } = await loadIncome(
      this.incomes,
      this.investment,
      input.id,
      input.accessibleOwners,
    );
    const asset = await loadWritableAsset(this.investment, income.assetId, input.accessibleOwners);

    await assertIncomeAccountChangeable(this.investment, input.accessibleOwners, income.accountId);

    const current = draftFromIncome(income, input.userId, {
      accountId: input.accountId,
      categoryId: input.categoryId,
    });

    return persistIncome(this.incomes, this.investment, input.accessibleOwners, asset, {
      ...current,
      accountId: input.accountId ?? current.accountId,
      amountPerUnit:
        input.amountPerUnit === undefined ? current.amountPerUnit : input.amountPerUnit,
      categoryId: input.categoryId ?? current.categoryId,
      exDate: input.exDate === undefined ? current.exDate : input.exDate,
      netAmount: input.netAmount ?? current.netAmount,
      notes: input.notes === undefined ? current.notes : input.notes,
      paymentDate: input.paymentDate ?? current.paymentDate,
      quantity: input.quantity === undefined ? current.quantity : input.quantity,
      status: input.status ?? current.status,
      type: input.type ?? current.type,
    });
  }
}
