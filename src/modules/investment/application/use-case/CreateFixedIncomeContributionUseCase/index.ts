import { Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  CreateFixedIncomeContributionInput,
  CreateFixedIncomeContributionSchema,
} from '@investment/application/dto/FixedIncome';
import {
  assertRatesCoverContributions,
  contributionDatesOf,
  FixedIncomeWriteResult,
  loadCalculatedTitle,
  mapFixedIncomeErrors,
  principalOf,
  resultOf,
} from '@investment/application/service/FixedIncomeRules';
import { resolveOperationAccount } from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { InvestmentOperationType } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

export const AFTER_MATURITY_MESSAGE = 'A contribution cannot be dated after the maturity';

// Spec 105 FR 13-14: a contribution is a lot with its own date; the finance row is 102's contribution row.
export class CreateFixedIncomeContributionUseCase implements UseCaseWithParams<
  CreateFixedIncomeContributionInput,
  FixedIncomeWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: CreateFixedIncomeContributionInput): Promise<FixedIncomeWriteResult> {
    const input = validate(CreateFixedIncomeContributionSchema, params);
    const { asset, data } = await loadCalculatedTitle(
      this.repository,
      input.assetId,
      input.accessibleOwners,
    );

    if (input.date > data.terms.maturityDate) {
      throw new UnprocessableEntityException(AFTER_MATURITY_MESSAGE);
    }

    assertRatesCoverContributions(
      data.rates.map((rate) => rate.startDate),
      [...contributionDatesOf(asset), input.date],
    );

    if (input.generateTransaction && input.accountId) {
      await resolveOperationAccount(
        this.repository,
        input.accessibleOwners,
        input.accountId,
        'BRL',
      );
    }

    const operationId = await mapFixedIncomeErrors(async () =>
      this.repository.writeOperation({
        accountId: input.generateTransaction ? (input.accountId ?? null) : null,
        assetId: asset.id,
        assetLabel: asset.name,
        currency: 'BRL',
        date: input.date,
        fees: [],
        feesTotal: 0,
        fxRate: null,
        generateTransaction: input.generateTransaction,
        gross: input.amount,
        quantity: principalOf(input.amount),
        total: input.amount,
        type: InvestmentOperationType.BUY,
        unitPrice: Decimal8.parse('1'),
      }),
    );

    return resultOf(this.repository, this.quotes, asset.id, operationId, null);
  }
}
