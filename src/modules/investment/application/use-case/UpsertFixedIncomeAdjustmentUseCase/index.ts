import { Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  UpsertFixedIncomeAdjustmentInput,
  UpsertFixedIncomeAdjustmentSchema,
} from '@investment/application/dto/FixedIncome';
import { AssetDetailView } from '@investment/application/service/AssetView';
import {
  contributionDatesOf,
  detailViewOf,
  loadCalculatedTitle,
  mapFixedIncomeErrors,
} from '@investment/application/service/FixedIncomeRules';
import { toCalcInput } from '@investment/application/service/FixedIncomeView';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { IInvestmentRepository } from '@investment/domain/repository';
import { calculateTitle } from '@investment/domain/service/FixedIncomeCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface UpsertFixedIncomeAdjustmentResult {
  // The gross the curve gave on that date before this adjustment, so the app shows the difference.
  computedGross: number;
  detail: AssetDetailView;
  item: { date: string; grossAmount: number; id: string };
}

// Spec 105 FR 24: the gross the bank shows on a date becomes the base of the calculation from then on.
export class UpsertFixedIncomeAdjustmentUseCase implements UseCaseWithParams<
  UpsertFixedIncomeAdjustmentInput,
  UpsertFixedIncomeAdjustmentResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(
    params: UpsertFixedIncomeAdjustmentInput,
  ): Promise<UpsertFixedIncomeAdjustmentResult> {
    const input = validate(UpsertFixedIncomeAdjustmentSchema, params);
    const { asset, data } = await loadCalculatedTitle(
      this.repository,
      input.assetId,
      input.accessibleOwners,
    );
    const first = contributionDatesOf(asset).sort()[0];

    if (!first || input.date < first || input.date > data.terms.maturityDate) {
      throw new UnprocessableEntityException(
        'The adjustment date must be between the first contribution and the maturity',
      );
    }

    const others = {
      ...data,
      adjustments: data.adjustments.filter((row) => row.date !== input.date),
    };
    const computed = calculateTitle(
      toCalcInput(others, [...asset.operations].reverse(), input.date),
    );

    await mapFixedIncomeErrors(async () =>
      this.repository.upsertFixedIncomeAdjustment(asset.id, input.date, input.grossAmount),
    );

    const detail = await detailViewOf(this.repository, this.quotes, asset.id);
    const saved = detail.fixedIncome?.adjustments.find((row) => row.date === input.date);

    return {
      computedGross: computed.totals.gross,
      detail,
      item: { date: input.date, grossAmount: input.grossAmount, id: saved?.id ?? '' },
    };
  }
}
