import { Inject, NotFoundException } from '@nestjs/common';

import {
  UpsertValuationInput,
  UpsertValuationSchema,
} from '@investment/application/dto/OperationInput';
import { AssetView, detailToListRow, toAssetView } from '@investment/application/service/AssetView';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface UpsertValuationResult {
  asset: AssetView;
  valuation: ValuationEntity;
}

// Spec 102 FR 25: one valuation per asset and date; the same date replaces its price.
export class UpsertValuationUseCase implements UseCaseWithParams<
  UpsertValuationInput,
  UpsertValuationResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: UpsertValuationInput): Promise<UpsertValuationResult> {
    const input = validate(UpsertValuationSchema, params);

    await loadWritableAsset(this.repository, input.assetId, input.accessibleOwners);

    const valuation = await this.repository.upsertValuation({
      assetId: input.assetId,
      date: input.date,
      unitPrice: input.unitPrice,
    });
    const detail = await this.repository.findAssetById(input.assetId);

    if (!detail) {
      throw new NotFoundException();
    }

    const row = detailToListRow(detail);

    return { asset: toAssetView(row, await this.quotes.load([row])), valuation };
  }
}
