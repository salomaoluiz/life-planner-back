import { ConflictException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  ChangePurchaseStatusInput,
  ChangePurchaseStatusSchema,
} from '@stock/application/dto/Purchase';
import { isClosingLocked, loadWritablePurchase } from '@stock/application/service/PurchaseAccess';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { IPurchaseRepository } from '@stock/domain/repository';

const TRANSITIONS = {
  DISCARD: {
    from: [PurchaseStatuses.ENDED, PurchaseStatuses.OPEN],
    to: PurchaseStatuses.DISCARDED,
  },
  END: { from: [PurchaseStatuses.OPEN], to: PurchaseStatuses.ENDED },
  REOPEN: { from: [PurchaseStatuses.ENDED], to: PurchaseStatuses.OPEN },
} as const;

// Spec 120 FR 5/7: end freezes the cart, reopen returns it, discard keeps the rows for history only.
export class ChangePurchaseStatusUseCase implements UseCaseWithParams<
  ChangePurchaseStatusInput,
  PurchaseEntity
> {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: ChangePurchaseStatusInput): Promise<PurchaseEntity> {
    const input = validate(ChangePurchaseStatusSchema, params);
    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );
    const transition = TRANSITIONS[input.action];
    const from: readonly PurchaseStatuses[] = transition.from;

    if (!from.includes(purchase.status)) {
      throw new ConflictException({
        code: 'PURCHASE_NOT_OPEN',
        message: 'The purchase cannot go through this change',
      });
    }

    if (isClosingLocked(purchase, new Date()) && purchase.closingBy !== input.userId) {
      throw new ConflictException({
        code: 'PURCHASE_CLOSING',
        message: 'Someone is closing this purchase',
      });
    }

    return this.purchaseRepository.transition(
      purchase.id,
      transition.to,
      input.userId,
      input.clientId,
    );
  }
}
