import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetStockItemsInput, GetStockItemsSchema } from '@stock/application/dto/GetStockItems';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';
import { descendantIds } from '@stock/domain/service/CategoryTree';
import { compareNullsLast } from '@stock/domain/service/NullsLast';

// Spec 116 FR 34: nearest effective expiration ascending (nulls last), then description case-insensitive, then id.
export class GetStockItemsUseCase implements UseCaseWithParams<
  GetStockItemsInput,
  StockItemView[]
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    @Inject(RefreshStaleForecastsUseCase)
    private readonly refreshStaleForecasts: RefreshStaleForecastsUseCase,
  ) {}

  async execute(params: GetStockItemsInput): Promise<StockItemView[]> {
    const input = validate(GetStockItemsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerId);

    if (owners.length === 0) {
      return [];
    }

    const today = input.today ?? todayUtc();

    // Spec 123 FR 14: stale forecasts are recomputed before the read.
    await this.refreshStaleForecasts.execute({ owners, today });

    const catalog = await loadCatalogLookup(this.catalogRepository, owners);
    // FR 25: a category filter includes its subcategories; an id nobody knows is kept and matches nothing.
    const categoryIds = input.categoryIds && [
      ...new Set(input.categoryIds.flatMap((id) => descendantIds(catalog.categories, id))),
    ];
    const items = await this.stockRepository.findByOwners(owners, {
      categoryIds,
      locationIds: input.locationIds,
    });
    return items.map((item) => toStockItemView(item, today, catalog)).sort(compareViews);
  }
}

function compareViews(a: StockItemView, b: StockItemView): number {
  return (
    compareNullsLast(a.nearestExpiration?.getTime(), b.nearestExpiration?.getTime()) ||
    a.item.description.toLowerCase().localeCompare(b.item.description.toLowerCase()) ||
    a.item.id.localeCompare(b.item.id)
  );
}
