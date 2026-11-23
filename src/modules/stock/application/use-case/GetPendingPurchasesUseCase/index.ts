import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetPendingPurchasesInput,
  GetPendingPurchasesSchema,
} from '@stock/application/dto/Purchase';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import { IPurchaseRepository, PendingPurchase } from '@stock/domain/repository';

const EMPTY_DISCARD_MS = 24 * 60 * 60 * 1000;

// Spec 120 FR 8/45: open purchases idle for 12 h and every ended one; empty ones idle 24 h are discarded first.
export class GetPendingPurchasesUseCase implements UseCaseWithParams<
  GetPendingPurchasesInput,
  PendingPurchase[]
> {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: GetPendingPurchasesInput): Promise<PendingPurchase[]> {
    const input = validate(GetPendingPurchasesSchema, params);
    const now = input.now ?? new Date();
    const owners = narrowOwners(input.accessibleOwners);

    await this.purchaseRepository.discardIdle(owners, new Date(now.getTime() - EMPTY_DISCARD_MS));

    return this.purchaseRepository.findPending(owners, now);
  }
}
