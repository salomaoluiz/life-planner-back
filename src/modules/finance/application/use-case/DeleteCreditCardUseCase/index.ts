import { Inject, NotFoundException } from '@nestjs/common';

import {
  DeleteCreditCardInput,
  DeleteCreditCardSchema,
} from '@finance/application/dto/DeleteCreditCard';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// The 409 "Credit card has transactions" guard arrives with the spec that links transactions to cards.
export class DeleteCreditCardUseCase implements UseCaseWithParams<DeleteCreditCardInput, void> {
  constructor(
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: DeleteCreditCardInput): Promise<void> {
    const input = validate(DeleteCreditCardSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.id);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    await this.creditCardRepository.deleteCreditCard(input.id);
  }
}
