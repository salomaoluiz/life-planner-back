import { Inject, NotFoundException } from '@nestjs/common';

import { FixedIncomeIdInput, FixedIncomeIdSchema } from '@investment/application/dto/FixedIncome';
import {
  assertRatesCoverContributions,
  contributionDatesOf,
  loadCalculatedTitle,
  mapFixedIncomeErrors,
} from '@investment/application/service/FixedIncomeRules';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 105 FR 8: the only entry cannot go, and the remaining first one must still cover the first contribution.
export class DeleteFixedIncomeRateUseCase implements UseCaseWithParams<FixedIncomeIdInput, void> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: FixedIncomeIdInput): Promise<void> {
    const input = validate(FixedIncomeIdSchema, params);
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

    assertRatesCoverContributions(
      data.rates.filter((rate) => rate.id !== current.id).map((rate) => rate.startDate),
      contributionDatesOf(asset),
    );

    await mapFixedIncomeErrors(async () =>
      this.repository.deleteFixedIncomeRate(asset.id, current.id),
    );
  }
}
