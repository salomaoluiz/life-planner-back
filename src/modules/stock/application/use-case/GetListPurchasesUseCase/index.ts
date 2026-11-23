import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetListPurchasesInput, GetListPurchasesSchema } from '@stock/application/dto/Purchase';
import { PurchaseView } from '@stock/application/service/PurchaseView';
import { loadPurchaseViews } from '@stock/application/service/PurchaseViewLoader';
import { loadReadableList } from '@stock/application/service/ShoppingListAccess';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { IPurchaseRepository, IShoppingListRepository } from '@stock/domain/repository';

// FR 8: an open purchase without checked rows idle for this long is discarded on the next read of its list.
const EMPTY_DISCARD_MS = 24 * 60 * 60 * 1000;

export interface ListPurchasesOutput {
  closed?: { items: PurchaseEntity[]; nextCursor?: { closedAt: Date; id: string } };
  open?: PurchaseView[];
}

// Spec 120 FR 43: the open/ended purchases with their views, or a keyset page of the closed ones.
export class GetListPurchasesUseCase implements UseCaseWithParams<
  GetListPurchasesInput,
  ListPurchasesOutput
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: GetListPurchasesInput): Promise<ListPurchasesOutput> {
    const input = validate(GetListPurchasesSchema, params);
    const list = await loadReadableList(this.listRepository, input.accessibleOwners, input.listId);

    if (input.closed) {
      const page = await this.purchaseRepository.findClosedByList(
        list.id,
        input.limit + 1,
        input.cursor,
      );
      const items = page.slice(0, input.limit);
      const last = items[items.length - 1];

      return {
        closed: {
          items,
          nextCursor:
            page.length > input.limit && last?.closedAt
              ? { closedAt: last.closedAt, id: last.id }
              : undefined,
        },
      };
    }

    const now = input.now ?? new Date();

    await this.purchaseRepository.discardIdle(
      [{ owner: list.owner, ownerId: list.ownerId }],
      new Date(now.getTime() - EMPTY_DISCARD_MS),
    );

    const purchases = await this.purchaseRepository.findByList(list.id, [
      PurchaseStatuses.OPEN,
      PurchaseStatuses.ENDED,
    ]);

    return {
      open: await loadPurchaseViews(
        { lists: this.listRepository, purchases: this.purchaseRepository },
        list.id,
        purchases,
      ),
    };
  }
}
