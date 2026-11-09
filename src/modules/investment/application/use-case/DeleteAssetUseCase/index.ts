import { Inject, NotFoundException } from '@nestjs/common';

import { AssetAccessInput, AssetAccessSchema } from '@investment/application/dto/AssetAccess';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 8: deletes the asset with its operations, fees, valuations and linked finance rows.
export class DeleteAssetUseCase implements UseCaseWithParams<AssetAccessInput, void> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: AssetAccessInput): Promise<void> {
    const input = validate(AssetAccessSchema, params);
    const asset = await this.repository.findAssetById(input.id);

    if (!asset || !hasOwnerAccess(input.accessibleOwners, asset)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, asset);
    await this.repository.deleteAsset(asset.id);
  }
}
