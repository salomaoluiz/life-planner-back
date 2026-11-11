import { Inject } from '@nestjs/common';

import { GetAssetsInput, GetAssetsSchema } from '@investment/application/dto/AssetAccess';
import { AssetView, toAssetView } from '@investment/application/service/AssetView';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { narrowOwners } from '@investment/domain/entity/OwnerAccess';
import { ICorporateEventRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 108 FR 32: a list item also counts the event suggestions waiting for a decision.
export type AssetListItem = { pendingEventSuggestions: number } & AssetView;

// Spec 102 FR 26: every asset the caller can read; the repository sorts by class, then ticker and name.
export class GetAssetsUseCase implements UseCaseWithParams<GetAssetsInput, AssetListItem[]> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    @Inject('ICorporateEventRepository')
    private readonly events: ICorporateEventRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: GetAssetsInput): Promise<AssetListItem[]> {
    const input = validate(GetAssetsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerId);

    if (owners.length === 0) {
      return [];
    }

    const rows = await this.repository.findAssetsByOwners(owners, input.status);

    const [context, pending] = await Promise.all([
      this.quotes.load(rows),
      this.events.countPendingByAsset(rows.map((row) => row.id)),
    ]);

    return rows.map((row) => ({
      ...toAssetView(row, context),
      pendingEventSuggestions: pending.get(row.id) ?? 0,
    }));
  }
}
