import { Inject, NotFoundException } from '@nestjs/common';

import { FixedIncomeIdInput, FixedIncomeIdSchema } from '@investment/application/dto/FixedIncome';
import {
  loadCalculatedTitle,
  mapFixedIncomeErrors,
} from '@investment/application/service/FixedIncomeRules';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 105 FR 24: deleting an adjustment re-runs the calculation.
export class DeleteFixedIncomeAdjustmentUseCase implements UseCaseWithParams<
  FixedIncomeIdInput,
  void
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: FixedIncomeIdInput): Promise<void> {
    const input = validate(FixedIncomeIdSchema, params);
    const current = await this.repository.findFixedIncomeAdjustmentById(input.id);
    const found = current ? await this.repository.findAssetById(current.assetId) : undefined;

    if (!current || !found || !hasOwnerAccess(input.accessibleOwners, found)) {
      throw new NotFoundException();
    }

    const { asset } = await loadCalculatedTitle(this.repository, found.id, input.accessibleOwners);

    await mapFixedIncomeErrors(async () =>
      this.repository.deleteFixedIncomeAdjustment(asset.id, current.id),
    );
  }
}
