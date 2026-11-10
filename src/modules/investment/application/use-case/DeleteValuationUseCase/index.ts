import { Inject, NotFoundException } from '@nestjs/common';

import {
  OperationAccessInput,
  OperationAccessSchema,
} from '@investment/application/dto/OperationInput';
import { assertNotCalculated } from '@investment/application/service/FixedIncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class DeleteValuationUseCase implements UseCaseWithParams<OperationAccessInput, void> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: OperationAccessInput): Promise<void> {
    const input = validate(OperationAccessSchema, params);
    const valuation = await this.repository.findValuationById(input.id);
    const asset = valuation ? await this.repository.findAssetById(valuation.assetId) : undefined;

    if (!valuation || !asset || !hasOwnerAccess(input.accessibleOwners, asset)) {
      throw new NotFoundException();
    }

    const writable = await loadWritableAsset(this.repository, asset.id, input.accessibleOwners);

    await assertNotCalculated(this.repository, writable);
    await this.repository.deleteValuation(valuation.id);
  }
}
