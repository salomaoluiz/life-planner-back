import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  ConfirmProjectedTransactionInput,
  ConfirmProjectedTransactionSchema,
} from '@finance/application/dto/ConfirmProjectedTransaction';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { TransactionWithLimit } from '@finance/application/use-case/CreateTransactionUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import {
  invoiceMonthOf,
  isOverLimit,
  isPurchaseInvoiceAllowed,
} from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 096 FR 4: a projected card purchase becomes effective with the real value and date. The invoice follows the
// date (095 rules when `invoiceMonth` is sent); a paid target invoice is refused by the write under the card lock.
// On a series row only this occurrence changes: the series and the later occurrences stay projected.
export class ConfirmProjectedTransactionUseCase implements UseCaseWithParams<
  ConfirmProjectedTransactionInput,
  TransactionWithLimit
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: ConfirmProjectedTransactionInput): Promise<TransactionWithLimit> {
    const input = validate(ConfirmProjectedTransactionSchema, params);
    const transaction = await this.transactionRepository.findTransactionScalarsById(input.id);

    if (!transaction || !hasOwnerAccess(input.accessibleOwners, transaction)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, transaction);

    if (!transaction.projected) {
      throw new ConflictException('Transaction is not projected');
    }

    const { card } = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      blockArchivedAccount: false,
      blockArchivedCategory: false,
      categoryId: transaction.categoryId,
      creditCardId: transaction.creditCardId as string,
      currency: transaction.currency,
      owner: transaction.owner,
      ownerId: transaction.ownerId,
      type: transaction.type,
    });

    if (!card) {
      throw new UnprocessableEntityException('Projected is only for card expenses');
    }
    if (
      input.invoiceMonth !== undefined &&
      !isPurchaseInvoiceAllowed(input.date, card.closingDay, input.invoiceMonth)
    ) {
      throw new UnprocessableEntityException('Invoice is not available for this date');
    }

    const updated = await this.transactionRepository.updateTransaction({
      date: input.date,
      id: input.id,
      invoiceMonth: input.invoiceMonth ?? invoiceMonthOf(input.date, card.closingDay),
      projected: false,
      value: input.value,
    });
    const invoiceData = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    return {
      invoiceData,
      overLimit: isOverLimit(invoiceData[0].invoices, card.limit),
      transaction: updated,
    };
  }
}
