import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetItemPricesInput, GetItemPricesSchema } from '@stock/application/dto/Purchase';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IPurchaseRepository, IStockRepository, PriceHistoryPoint } from '@stock/domain/repository';

export interface ItemPricesOutput {
  items: PriceHistoryPoint[];
  nextCursor?: { date: Date; id: string };
}

// Spec 120 FR 37: keyset pages of the last 24 months of prices, per market or across them.
export class GetItemPricesUseCase implements UseCaseWithParams<
  GetItemPricesInput,
  ItemPricesOutput
> {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: GetItemPricesInput): Promise<ItemPricesOutput> {
    const input = validate(GetItemPricesSchema, params);
    const item = await this.stockRepository.findById(input.itemId);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    const page = await this.purchaseRepository.findPriceHistory(
      item.id,
      input.limit + 1,
      input.marketId,
      input.cursor,
    );
    const items = page.slice(0, input.limit);
    const last = items[items.length - 1];

    return {
      items,
      nextCursor: page.length > input.limit && last ? { date: last.date, id: last.id } : undefined,
    };
  }
}
