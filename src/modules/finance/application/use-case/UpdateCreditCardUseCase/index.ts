import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import {
  UpdateCreditCardInput,
  UpdateCreditCardSchema,
} from '@finance/application/dto/UpdateCreditCard';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateCreditCardUseCase implements UseCaseWithParams<
  UpdateCreditCardInput,
  CreditCardEntity
> {
  constructor(
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: UpdateCreditCardInput): Promise<CreditCardEntity> {
    const input = validate(UpdateCreditCardSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.id);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    // Unlike accounts, the owner can change: the new owner must also be accessible to the caller.
    if (
      input.owner !== undefined &&
      input.ownerId !== undefined &&
      !hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })
    ) {
      throw new ForbiddenException('Owner not accessible');
    }

    return this.creditCardRepository.updateCreditCard({
      brand: input.brand,
      closingDay: input.closingDay,
      color: input.color,
      dueDay: input.dueDay,
      id: input.id,
      lastDigits: input.lastDigits,
      limit: input.limit,
      owner: input.owner,
      ownerId: input.ownerId,
      paymentDay: input.paymentDay,
      status: input.status,
      title: input.title,
    });
  }
}
