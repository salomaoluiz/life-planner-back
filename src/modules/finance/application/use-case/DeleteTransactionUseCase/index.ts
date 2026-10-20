import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  DeleteTransactionInput,
  DeleteTransactionSchema,
} from '@finance/application/dto/DeleteTransaction';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { CARD_CREDIT_KEYS } from '@finance/domain/entity/SystemCategory';
import { InstallmentEditScope, SystemCategoryKey } from '@finance/domain/enum';
import {
  IFinanceCardCreditRepository,
  IFinanceRecurrenceRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class DeleteTransactionUseCase implements UseCaseWithParams<DeleteTransactionInput, void> {
  constructor(
    @Inject('IFinanceCardCreditRepository')
    private readonly cardCreditRepository: IFinanceCardCreditRepository,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: DeleteTransactionInput): Promise<void> {
    const input = validate(DeleteTransactionSchema, params);

    const transaction = await this.transactionRepository.findTransactionById(input.id);

    if (!transaction || !hasOwnerAccess(input.accessibleOwners, transaction)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, transaction);

    // An installment only goes away with its whole plan (spec 030 FR 19).
    if (transaction.installmentPlanId) {
      throw new UnprocessableEntityException('Delete the installment plan');
    }

    if (transaction.recurrenceId && input.scope === undefined) {
      throw new UnprocessableEntityException('Choose the delete scope');
    }
    if (transaction.recurrenceId && input.scope !== InstallmentEditScope.ONLY_THIS) {
      throw new UnprocessableEntityException('Use the recurrence to delete more occurrences');
    }

    // The payment transaction goes away only with the payment itself.
    if (transaction.category.systemKey === SystemCategoryKey.INVOICE_PAYMENT) {
      throw new UnprocessableEntityException('Use the invoice to change this payment');
    }

    // Refunds, discounts and early payments are removed through the card endpoints (spec 032).
    if (
      transaction.category.systemKey !== null &&
      CARD_CREDIT_KEYS.includes(transaction.category.systemKey)
    ) {
      throw new UnprocessableEntityException('Use the card to change this credit');
    }

    // A purchase that was refunded goes away only after its refunds (spec 032 FR 26).
    if ((await this.cardCreditRepository.countRefundsByTransactionId(transaction.id)) > 0) {
      throw new UnprocessableEntityException('Delete its refunds first');
    }

    await this.transactionRepository.deleteTransaction(input.id);

    // A projected occurrence that was made real and is now deleted must not come back at the horizon (FR 29).
    if (transaction.recurrenceId) {
      await this.hideDeletedNumber(
        transaction.recurrenceId,
        transaction.occurrenceNumber as number,
      );
    }
  }

  private async hideDeletedNumber(recurrenceId: string, occurrenceNumber: number): Promise<void> {
    const series = await this.recurrenceRepository.findById(recurrenceId);

    if (series && occurrenceNumber > series.firstNumber - 1 + series.lastGeneratedNumber) {
      await this.recurrenceRepository.skipNumber(series.id, occurrenceNumber);
    }
  }
}
