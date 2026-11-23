import { Inject } from '@nestjs/common';

import { validate } from '@shared/infra/validation';
import {
  DeleteClosedPurchaseInput,
  DeleteClosedPurchaseSchema,
} from '@stock/application/dto/Purchase';
import { loadWritablePurchase } from '@stock/application/service/PurchaseAccess';
import { FinanceReference, IPurchaseRepository, PurchaseRowRecord } from '@stock/domain/repository';

export type CancelClosingFinance = (reference: FinanceReference) => Promise<void>;

// Spec 120 FR 41: removes the finance posting, the price history and the untouched entries; rows whose lot was
// already used keep their stock and come back in `kept`.
export class DeleteClosedPurchaseUseCase {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(
    params: DeleteClosedPurchaseInput,
    cancelFinance: CancelClosingFinance,
  ): Promise<{ kept: PurchaseRowRecord[] }> {
    const input = validate(DeleteClosedPurchaseSchema, params);
    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );

    return this.purchaseRepository.deleteClosed(purchase.id, input.userId, cancelFinance);
  }
}
