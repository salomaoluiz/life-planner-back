import { ConflictException, Inject, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { MergePurchaseInput, MergePurchaseSchema } from '@stock/application/dto/Purchase';
import { loadWritablePurchase } from '@stock/application/service/PurchaseAccess';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { IPurchaseRepository } from '@stock/domain/repository';

const MERGEABLE = [PurchaseStatuses.ENDED, PurchaseStatuses.OPEN];

// Spec 120 FR 4: moves every row of an open/ended purchase into another of the same list and discards it.
export class MergePurchaseUseCase implements UseCaseWithParams<MergePurchaseInput, PurchaseEntity> {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
  ) {}

  async execute(params: MergePurchaseInput): Promise<PurchaseEntity> {
    const input = validate(MergePurchaseSchema, params);
    const source = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.id,
    );
    const target = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.targetId,
    );

    if (source.id === target.id || source.listId !== target.listId) {
      throw new UnprocessableEntityException('Choose another purchase of the same list');
    }

    if (!MERGEABLE.includes(source.status) || !MERGEABLE.includes(target.status)) {
      throw new ConflictException({
        code: 'PURCHASE_NOT_OPEN',
        message: 'Only open or ended purchases can be merged',
      });
    }

    return this.purchaseRepository.mergeInto(source.id, target.id, input.userId);
  }
}
