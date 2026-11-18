import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetShoppingListByIdInput,
  GetShoppingListByIdSchema,
} from '@stock/application/dto/ShoppingList';
import { loadReadableList } from '@stock/application/service/ShoppingListAccess';
import { ShoppingListDetail, toListDetail } from '@stock/application/service/ShoppingListView';
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
  ) {}

  async execute(params: GetShoppingListByIdInput): Promise<ShoppingListDetail> {
    const input = validate(GetShoppingListByIdSchema, params);
    const list = await loadReadableList(this.listRepository, input.accessibleOwners, input.id);
    const [rows, categories] = await Promise.all([
      this.listRepository.findRowsByLists([list.id]),
      this.catalogRepository.findCategories(list),
    ]);

    return toListDetail(list, rows, categories);
  }
}
