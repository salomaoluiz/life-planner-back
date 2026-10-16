import { Inject, NotFoundException } from '@nestjs/common';

import {
  DeleteCardEarlyPaymentInput,
  DeleteCardEarlyPaymentSchema,
} from '@finance/application/dto/DeleteCardEarlyPayment';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SystemCategoryKey } from '@finance/domain/enum';
import {
  IFinanceCardCreditRepository,
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Deleting an early payment also removes its account row; the datasource answers 422 WHEN the invoice has a payment record (FR 34).
export class DeleteCardEarlyPaymentUseCase implements UseCaseWithParams<
  DeleteCardEarlyPaymentInput,
  void
> {
  constructor(
    @Inject('IFinanceCardCreditRepository')
    private readonly cardCreditRepository: IFinanceCardCreditRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: DeleteCardEarlyPaymentInput): Promise<void> {
    const input = validate(DeleteCardEarlyPaymentSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    const payment = await this.transactionRepository.findTransactionById(input.id);

    if (
      !payment ||
      payment.creditCardId !== card.id ||
      payment.category.systemKey !== SystemCategoryKey.CARD_EARLY_PAYMENT
    ) {
      throw new NotFoundException();
    }

    await this.cardCreditRepository.deleteCredit(payment.id);
  }
}
