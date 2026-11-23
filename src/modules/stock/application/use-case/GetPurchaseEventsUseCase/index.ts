import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetPurchaseEventsInput, GetPurchaseEventsSchema } from '@stock/application/dto/Purchase';
import { loadReadableList } from '@stock/application/service/ShoppingListAccess';
import {
  IPurchaseRepository,
  IShoppingListRepository,
  PurchaseEventRecord,
} from '@stock/domain/repository';

// Spec 120 FR 25: events after `Last-Event-ID` (kept 24 h); the access check also guards the stream.
export const EVENT_REPLAY_LIMIT = 500;

export class GetPurchaseEventsUseCase implements UseCaseWithParams<
  GetPurchaseEventsInput,
  PurchaseEventRecord[]
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: GetPurchaseEventsInput): Promise<PurchaseEventRecord[]> {
    const input = validate(GetPurchaseEventsSchema, params);
    const list = await loadReadableList(this.listRepository, input.accessibleOwners, input.listId);

    return this.purchaseRepository.findEventsAfter(list.id, input.afterId, EVENT_REPLAY_LIMIT);
  }
}
