import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetPurchaseInput, GetPurchaseSchema } from '@stock/application/dto/Purchase';
import { loadReadablePurchase } from '@stock/application/service/PurchaseAccess';
import { PurchaseView } from '@stock/application/service/PurchaseView';
import { loadPurchaseViews } from '@stock/application/service/PurchaseViewLoader';
import { IPurchaseRepository, IShoppingListRepository } from '@stock/domain/repository';

// Spec 120 FR 19-20: the purchase with its rows, cart, remaining estimate and price changes.
export class GetPurchaseUseCase implements UseCaseWithParams<GetPurchaseInput, PurchaseView> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: GetPurchaseInput): Promise<PurchaseView> {
    const input = validate(GetPurchaseSchema, params);
    const purchase = await loadReadablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );
    const [view] = await loadPurchaseViews(
      { lists: this.listRepository, purchases: this.purchaseRepository },
      purchase.listId,
      [purchase],
    );

    return view;
  }
}
