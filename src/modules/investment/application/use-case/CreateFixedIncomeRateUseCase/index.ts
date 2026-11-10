import { ConflictException, Inject } from '@nestjs/common';

import {
  CreateFixedIncomeRateInput,
  CreateFixedIncomeRateSchema,
} from '@investment/application/dto/FixedIncome';
import { AssetDetailView } from '@investment/application/service/AssetView';
import {
  assertRatesCoverContributions,
  contributionDatesOf,
  detailViewOf,
  loadCalculatedTitle,
  mapFixedIncomeErrors,
  RATE_EXISTS_MESSAGE,
  toRateWrite,
} from '@investment/application/service/FixedIncomeRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 105 FR 8-9: a new entry (for example "the CDI changed"); the past keeps the old rate.
export class CreateFixedIncomeRateUseCase implements UseCaseWithParams<
  CreateFixedIncomeRateInput,
  AssetDetailView
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: CreateFixedIncomeRateInput): Promise<AssetDetailView> {
    const input = validate(CreateFixedIncomeRateSchema, params);
    const { asset, data } = await loadCalculatedTitle(
      this.repository,
      input.assetId,
      input.accessibleOwners,
    );

    if (data.rates.some((rate) => rate.startDate === input.rate.startDate)) {
      throw new ConflictException(RATE_EXISTS_MESSAGE);
    }

    assertRatesCoverContributions(
      [...data.rates.map((rate) => rate.startDate), input.rate.startDate],
      contributionDatesOf(asset),
    );

    await mapFixedIncomeErrors(async () =>
      this.repository.createFixedIncomeRate(
        asset.id,
        toRateWrite(input.rate, input.rate.startDate),
      ),
    );

    return detailViewOf(this.repository, this.quotes, asset.id);
  }
}
