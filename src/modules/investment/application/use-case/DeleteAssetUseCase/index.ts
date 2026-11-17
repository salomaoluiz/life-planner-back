import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { AssetAccessInput, AssetAccessSchema } from '@investment/application/dto/AssetAccess';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const CONVERSION_EXISTS_MESSAGE =
  'This asset has a conversion. Delete the conversion before deleting the asset.';

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

    // Spec 112: a conversion hangs from both of its assets, so it is deleted first.
    if ((await this.repository.findConversionsByAssetIds([asset.id])).length > 0) {
      throw new UnprocessableEntityException(CONVERSION_EXISTS_MESSAGE);
    }

    await this.repository.deleteAsset(asset.id);
  }
}
