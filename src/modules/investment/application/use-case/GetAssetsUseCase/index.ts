import { Inject } from '@nestjs/common';

import { GetAssetsInput, GetAssetsSchema } from '@investment/application/dto/AssetAccess';
import { AssetView, toAssetView } from '@investment/application/service/AssetView';
import { narrowOwners } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 26: every asset the caller can read; the repository sorts by class, then ticker and name.
export class GetAssetsUseCase implements UseCaseWithParams<GetAssetsInput, AssetView[]> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: GetAssetsInput): Promise<AssetView[]> {
    const input = validate(GetAssetsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerId);

    if (owners.length === 0) {
      return [];
    }

    const rows = await this.repository.findAssetsByOwners(owners, input.status);

    return rows.map((row) => toAssetView(row));
  }
}
