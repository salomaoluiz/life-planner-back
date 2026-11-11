import { Inject, NotFoundException } from '@nestjs/common';

import {
  ApproveSuggestionInput,
  ApproveSuggestionSchema,
} from '@investment/application/dto/Income';
import {
  assertPending,
  IncomeView,
  incompleteError,
  persistIncome,
  resolveIncomeDefaults,
} from '@investment/application/service/IncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { suggestNet, withholdingBps } from '@investment/domain/service/IncomeWithholding';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 29-31: approving creates the planned income of the suggestion with the defaults; any field in the
// body overrides it (the edit path). Missing payment date, account, category or amount answers 422 INCOME_INCOMPLETE.
export class ApproveIncomeSuggestionUseCase implements UseCaseWithParams<
  ApproveSuggestionInput,
  IncomeView
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: ApproveSuggestionInput): Promise<IncomeView> {
    const input = validate(ApproveSuggestionSchema, params);
    const suggestion = await this.incomes.findSuggestionById(input.id);

    if (!suggestion) {
      throw new NotFoundException();
    }

    const asset = await loadWritableAsset(
      this.investment,
      suggestion.assetId,
      input.accessibleOwners,
    );

    assertPending(suggestion.status);

    const { event } = suggestion;
    const type = input.type ?? event.type;
    const exDate = input.exDate === undefined ? event.exDate : input.exDate;
    const defaults = await resolveIncomeDefaults(
      this.incomes,
      this.investment,
      input.accessibleOwners,
      asset,
      { exDate: exDate ?? undefined, type },
    );
    const quantity =
      input.quantity === undefined ? Decimal8.parse(suggestion.quantity) : input.quantity;
    const amountPerUnit =
      input.amountPerUnit === undefined ? Decimal8.parse(event.amountPerUnit) : input.amountPerUnit;
    const netAmount =
      input.netAmount ??
      (quantity && amountPerUnit
        ? suggestNet(quantity, amountPerUnit, withholdingBps(type, asset.assetClass))
        : 0);
    const paymentDate = input.paymentDate ?? event.paymentDate;
    const accountId = input.accountId ?? defaults.accountId;
    const categoryId = input.categoryId ?? defaults.categoryId;
    const missing = [
      ...(paymentDate ? [] : ['paymentDate']),
      ...(accountId ? [] : ['accountId']),
      ...(categoryId ? [] : ['categoryId']),
      ...(netAmount > 0 ? [] : ['netAmount']),
    ];

    if (!paymentDate || !accountId || !categoryId || missing.length > 0) {
      throw incompleteError(missing);
    }

    return persistIncome(this.incomes, this.investment, input.accessibleOwners, asset, {
      accountId,
      amountPerUnit,
      categoryId,
      createdBy: input.userId,
      exDate: exDate ?? null,
      netAmount,
      notes: input.notes,
      paymentDate,
      quantity,
      status: input.status ?? 'PLANNED',
      suggestionId: suggestion.id,
      type,
    });
  }
}
