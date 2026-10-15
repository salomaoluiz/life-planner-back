import { Inject, NotFoundException } from '@nestjs/common';

import {
  UndoInvoicePaymentInput,
  UndoInvoicePaymentSchema,
} from '@finance/application/dto/UndoInvoicePayment';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceCreditCardRepository,
  IFinanceInvoicePaymentRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Removes the payment record and, for an account payment, its transaction (the balance is restored).
export class UndoInvoicePaymentUseCase implements UseCaseWithParams<UndoInvoicePaymentInput, void> {
  constructor(
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceInvoicePaymentRepository')
    private readonly invoicePaymentRepository: IFinanceInvoicePaymentRepository,
  ) {}

  async execute(params: UndoInvoicePaymentInput): Promise<void> {
    const input = validate(UndoInvoicePaymentSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    const payment = await this.invoicePaymentRepository.findByCardAndMonth(
      card.id,
      input.invoiceMonth,
    );

    if (!payment) {
      throw new NotFoundException('Invoice is not paid');
    }

    await this.invoicePaymentRepository.undoPayment(card.id, input.invoiceMonth);
  }
}
