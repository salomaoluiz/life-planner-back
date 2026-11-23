import { ConflictException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { ClosingLockInput, ClosingLockSchema } from '@stock/application/dto/Purchase';
import { isClosingLocked, loadWritablePurchase } from '@stock/application/service/PurchaseAccess';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { IPurchaseRepository } from '@stock/domain/repository';

export interface ClosingLockOutput {
  closingAt?: Date;
  closingBy?: string;
}

// Spec 120 FR 30: one closer at a time; the lock lasts 15 minutes and is renewed by every closing request.
export class ClosingLockUseCase implements UseCaseWithParams<ClosingLockInput, ClosingLockOutput> {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: ClosingLockInput): Promise<ClosingLockOutput> {
    const input = validate(ClosingLockSchema, params);
    const now = input.now ?? new Date();
    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );

    if (input.release) {
      if (purchase.closingBy === input.userId) {
        await this.purchaseRepository.setClosing(purchase.id, null, now);
      }

      return {};
    }

    if (![PurchaseStatuses.ENDED, PurchaseStatuses.OPEN].includes(purchase.status)) {
      throw new ConflictException({
        code: 'PURCHASE_NOT_OPEN',
        message: 'The purchase is not open',
      });
    }

    if (isClosingLocked(purchase, now) && purchase.closingBy !== input.userId) {
      throw new ConflictException({
        by: { id: purchase.closingBy },
        code: 'PURCHASE_CLOSING',
        message: 'Someone is already closing this purchase',
      });
    }

    const locked = await this.purchaseRepository.setClosing(purchase.id, input.userId, now);

    return { closingAt: locked.closingAt, closingBy: locked.closingBy };
  }
}
