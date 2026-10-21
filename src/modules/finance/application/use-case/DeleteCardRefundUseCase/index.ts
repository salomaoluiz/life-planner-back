import { Inject, NotFoundException } from '@nestjs/common';

import {
  DeleteCardRefundInput,
  DeleteCardRefundSchema,
} from '@finance/application/dto/DeleteCardRefund';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { isRefundRow } from '@finance/application/service/RefundRow';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceCardCreditRepository,
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Deleting a refund; the datasource answers 422 WHEN its invoice has a payment record (spec 032 FR 25).
export class DeleteCardRefundUseCase implements UseCaseWithParams<DeleteCardRefundInput, void> {
  constructor(
    @Inject('IFinanceCardCreditRepository')
    private readonly cardCreditRepository: IFinanceCardCreditRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: DeleteCardRefundInput): Promise<void> {
    const input = validate(DeleteCardRefundSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, card);

    const refund = await this.transactionRepository.findTransactionById(input.id);

    if (!refund || refund.creditCardId !== card.id || !isRefundRow(refund)) {
      throw new NotFoundException();
    }

    await this.cardCreditRepository.deleteCredit(refund.id);
  }
}
