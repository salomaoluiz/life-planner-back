import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetShoppingListByIdInput,
  GetShoppingListByIdSchema,
} from '@stock/application/dto/ShoppingList';
import { loadReadableList } from '@stock/application/service/ShoppingListAccess';
import { ShoppingListDetail, toListDetail } from '@stock/application/service/ShoppingListView';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';
import { IShoppingListRepository, IStockCatalogRepository } from '@stock/domain/repository';

// Spec 118 FR 19-21: rows grouped by category with the subtotals and the estimate (one query for the rows, one
// for the categories).
export class GetShoppingListByIdUseCase implements UseCaseWithParams<
  GetShoppingListByIdInput,
  ShoppingListDetail
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    @Inject(RefreshStaleForecastsUseCase)
    private readonly refreshStaleForecasts: RefreshStaleForecastsUseCase,
  ) {}

  async execute(params: GetShoppingListByIdInput): Promise<ShoppingListDetail> {
    const input = validate(GetShoppingListByIdSchema, params);
    const list = await loadReadableList(this.listRepository, input.accessibleOwners, input.id);
    await this.refreshStaleForecasts.execute({
      owners: input.accessibleOwners.filter(
        (owner) => owner.owner === list.owner && owner.ownerId === list.ownerId,
      ),
    });

    const [rows, categories, closedDates] = await Promise.all([
      this.listRepository.findRowsByLists([list.id]),
      this.catalogRepository.findCategories(list),
      this.listRepository.findClosedPurchaseDates([list.id]),
    ]);

    return toListDetail(list, rows, categories, closedDates.get(list.id));
  }
}
