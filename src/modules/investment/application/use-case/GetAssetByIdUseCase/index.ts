import { Inject, NotFoundException } from '@nestjs/common';

import { AssetAccessInput, AssetAccessSchema } from '@investment/application/dto/AssetAccess';
import { AssetDetailView, toAssetDetailView } from '@investment/application/service/AssetView';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 27: the asset, its position, operations (newest first, sells with their result) and valuations.
export class GetAssetByIdUseCase implements UseCaseWithParams<AssetAccessInput, AssetDetailView> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: AssetAccessInput): Promise<AssetDetailView> {
    const input = validate(AssetAccessSchema, params);
    const asset = await this.repository.findAssetById(input.id);

    if (!asset || !hasOwnerAccess(input.accessibleOwners, asset)) {
      throw new NotFoundException();
    }

    return toAssetDetailView(asset);
  }
}
