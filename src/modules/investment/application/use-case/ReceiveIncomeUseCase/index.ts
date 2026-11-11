import { ConflictException, Inject } from '@nestjs/common';

import { ReceiveIncomeInput, ReceiveIncomeSchema } from '@investment/application/dto/Income';
import {
  assertIncomeAccountChangeable,
  draftFromIncome,
  IncomeView,
  loadIncome,
  persistIncome,
} from '@investment/application/service/IncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 12: confirm a planned income with the real net amount, date and (optionally) another account.
export class ReceiveIncomeUseCase implements UseCaseWithParams<ReceiveIncomeInput, IncomeView> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: ReceiveIncomeInput): Promise<IncomeView> {
    const input = validate(ReceiveIncomeSchema, params);
    const { income } = await loadIncome(
      this.incomes,
      this.investment,
      input.id,
      input.accessibleOwners,
    );
    const asset = await loadWritableAsset(this.investment, income.assetId, input.accessibleOwners);

    if (income.paid) {
      throw new ConflictException({ code: 'ALREADY_RECEIVED', message: 'Income already received' });
    }

    await assertIncomeAccountChangeable(this.investment, input.accessibleOwners, income.accountId);

    const current = draftFromIncome(income, input.userId, { accountId: input.accountId });

    return persistIncome(this.incomes, this.investment, input.accessibleOwners, asset, {
      ...current,
      accountId: input.accountId ?? current.accountId,
      netAmount: input.netAmount ?? current.netAmount,
      paymentDate: input.receivedOn ?? todayInSaoPaulo(),
      status: 'RECEIVED',
    });
  }
}
