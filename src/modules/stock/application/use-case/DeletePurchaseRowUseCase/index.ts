import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { DeletePurchaseRowInput, DeletePurchaseRowSchema } from '@stock/application/dto/Purchase';
import {
  ensureRowsWritable,
  loadWritablePurchase,
} from '@stock/application/service/PurchaseAccess';
import { IPurchaseRepository } from '@stock/domain/repository';

// Spec 120 FR 13/21: removing an already removed row is fine (queued retries).
export class DeletePurchaseRowUseCase implements UseCaseWithParams<DeletePurchaseRowInput, void> {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: DeletePurchaseRowInput): Promise<void> {
    const input = validate(DeletePurchaseRowSchema, params);
    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.purchaseId,
    );

    ensureRowsWritable(purchase, input.userId, new Date());
    await this.purchaseRepository.deleteRow({
      clientId: input.clientId,
      purchaseId: purchase.id,
      rowId: input.rowId,
      userId: input.userId,
    });
  }
}
