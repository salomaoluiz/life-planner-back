import { ConflictException, Inject, NotFoundException } from '@nestjs/common';

import {
  DeleteCreditCardInput,
  DeleteCreditCardSchema,
} from '@finance/application/dto/DeleteCreditCard';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceCreditCardRepository,
  IFinanceRecurrenceRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class DeleteCreditCardUseCase implements UseCaseWithParams<DeleteCreditCardInput, void> {
  constructor(
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: DeleteCreditCardInput): Promise<void> {
    const input = validate(DeleteCreditCardSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.id);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, card);

    // Purchases (and so every payment) keep the card: archive it instead.
    if ((await this.transactionRepository.countByCreditCardId(card.id)) > 0) {
      throw new ConflictException('Credit card has transactions');
    }

    if ((await this.recurrenceRepository.countBySource({ creditCardId: card.id })) > 0) {
      throw new ConflictException('Credit card has recurring transactions');
    }

    await this.creditCardRepository.deleteCreditCard(input.id);
  }
}
