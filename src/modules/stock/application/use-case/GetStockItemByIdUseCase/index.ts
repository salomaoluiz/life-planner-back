import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetStockItemByIdInput,
  GetStockItemByIdSchema,
} from '@stock/application/dto/GetStockItemById';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';

export class GetStockItemByIdUseCase implements UseCaseWithParams<
  GetStockItemByIdInput,
  StockItemView
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    @Inject(RefreshStaleForecastsUseCase)
    private readonly refreshStaleForecasts: RefreshStaleForecastsUseCase,
  ) {}

  async execute(params: GetStockItemByIdInput): Promise<StockItemView> {
    const input = validate(GetStockItemByIdSchema, params);

    const today = input.today ?? todayUtc();
    let item = await this.stockRepository.findById(input.id);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    // Spec 123 FR 14: a stale forecast is recomputed before the item is returned.
    if (!item.stockOnly && item.forecast?.computedOn?.getTime() !== today.getTime()) {
      await this.refreshStaleForecasts.execute({
        owners: input.accessibleOwners.filter(
          (owner) => owner.owner === item?.owner && owner.ownerId === item.ownerId,
        ),
        today,
      });
      item = (await this.stockRepository.findById(input.id)) ?? item;
    }

    return toStockItemView(item, today, await loadCatalogLookup(this.catalogRepository, [item]));
  }
}
