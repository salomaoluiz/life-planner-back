import { Inject, NotFoundException } from '@nestjs/common';

import { AssetAccessInput, AssetAccessSchema } from '@investment/application/dto/AssetAccess';
import { AssetDetailView, toAssetDetailView } from '@investment/application/service/AssetView';
import { withConversions } from '@investment/application/service/ConversionView';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 27: the asset, its position, operations (newest first, sells with their result) and valuations.
export class GetAssetByIdUseCase implements UseCaseWithParams<AssetAccessInput, AssetDetailView> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: AssetAccessInput): Promise<AssetDetailView> {
    const input = validate(AssetAccessSchema, params);
    const asset = await this.repository.findAssetById(input.id);

    if (!asset || !hasOwnerAccess(input.accessibleOwners, asset)) {
      throw new NotFoundException();
    }

    const [context, conversions] = await Promise.all([
      this.quotes.load([asset]),
      this.repository.findConversionsByAssetIds([asset.id]),
    ]);

    return withConversions(asset, toAssetDetailView(asset, context), conversions);
  }
}
