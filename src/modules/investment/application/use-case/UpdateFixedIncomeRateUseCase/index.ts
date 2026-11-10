import { ConflictException, Inject, NotFoundException } from '@nestjs/common';

import {
  UpdateFixedIncomeRateInput,
  UpdateFixedIncomeRateSchema,
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
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 105 FR 9: editing an entry re-runs the calculation from its date on.
export class UpdateFixedIncomeRateUseCase implements UseCaseWithParams<
  UpdateFixedIncomeRateInput,
  AssetDetailView
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: UpdateFixedIncomeRateInput): Promise<AssetDetailView> {
    const input = validate(UpdateFixedIncomeRateSchema, params);
    const current = await this.repository.findFixedIncomeRateById(input.id);
    const found = current ? await this.repository.findAssetById(current.assetId) : undefined;

    if (!current || !found || !hasOwnerAccess(input.accessibleOwners, found)) {
      throw new NotFoundException();
    }

    const { asset, data } = await loadCalculatedTitle(
      this.repository,
      found.id,
      input.accessibleOwners,
    );
    const others = data.rates.filter((rate) => rate.id !== current.id);

    if (others.some((rate) => rate.startDate === input.rate.startDate)) {
      throw new ConflictException(RATE_EXISTS_MESSAGE);
    }

    assertRatesCoverContributions(
      [...others.map((rate) => rate.startDate), input.rate.startDate],
      contributionDatesOf(asset),
    );

    await mapFixedIncomeErrors(async () =>
      this.repository.updateFixedIncomeRate(
        asset.id,
        current.id,
        toRateWrite(input.rate, input.rate.startDate),
      ),
    );

    return detailViewOf(this.repository, this.quotes, asset.id);
  }
}
