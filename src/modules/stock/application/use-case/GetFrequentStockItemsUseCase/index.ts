import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  FREQUENT_DAYS,
  GetFrequentStockItemsInput,
  GetFrequentStockItemsSchema,
} from '@stock/application/dto/GetFrequentStockItems';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';

const DAY_MS = 86_400_000;

// Spec 117 FR 16/28: the items with the most movements in the last 30 days among the owners the user can
// write (archived families excluded), for the quick add.
export class GetFrequentStockItemsUseCase implements UseCaseWithParams<
  GetFrequentStockItemsInput,
  StockItemView[]
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: GetFrequentStockItemsInput): Promise<StockItemView[]> {
    const input = validate(GetFrequentStockItemsSchema, params);
    const owners = narrowOwners(input.accessibleOwners);
    const since = new Date((input.now ?? new Date()).getTime() - FREQUENT_DAYS * DAY_MS);
    const ids = await this.stockRepository.findFrequentItemIds(owners, since, input.limit);

    if (ids.length === 0) {
      return [];
    }

    const items = await this.stockRepository.findByIds(ids);
    const catalog = await loadCatalogLookup(this.catalogRepository, owners);
    const today = input.today ?? todayUtc();

    return items.map((item) => toStockItemView(item, today, catalog));
  }
}
