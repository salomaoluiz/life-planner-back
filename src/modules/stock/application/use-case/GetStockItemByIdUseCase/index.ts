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
  ) {}

  async execute(params: GetStockItemByIdInput): Promise<StockItemView> {
    const input = validate(GetStockItemByIdSchema, params);

    const item = await this.stockRepository.findById(input.id);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    return toStockItemView(
      item,
      input.today ?? todayUtc(),
      await loadCatalogLookup(this.catalogRepository, [item]),
    );
  }
}
