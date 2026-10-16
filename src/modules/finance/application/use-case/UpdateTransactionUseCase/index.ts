import {
  ForbiddenException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  UpdateTransactionInput,
  UpdateTransactionSchema,
} from '@finance/application/dto/UpdateTransaction';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { TransactionWithLimit } from '@finance/application/use-case/CreateTransactionUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SystemCategoryKey } from '@finance/domain/enum';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateTransactionUseCase implements UseCaseWithParams<
  UpdateTransactionInput,
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

  async execute(params: UpdateTransactionInput): Promise<TransactionWithLimit> {
    const input = validate(UpdateTransactionSchema, params);

    const transaction = await this.transactionRepository.findTransactionById(input.id);

    if (!transaction || !hasOwnerAccess(input.accessibleOwners, transaction)) {
      throw new NotFoundException();
    }

    // Payments are removed by undoing the invoice payment; adjustments can be deleted, never edited.
    if (transaction.category.systemKey === SystemCategoryKey.INVOICE_PAYMENT) {
      throw new UnprocessableEntityException('Use the invoice to change this payment');
    }
    if (transaction.category.systemKey !== null) {
      throw new UnprocessableEntityException('Balance adjustments cannot be edited');
    }

    // The rules are checked against the resulting record (patch merged over the stored one).
    const owner = input.owner ?? transaction.owner;
    const ownerId = input.ownerId ?? transaction.ownerId;

    if (!hasOwnerAccess(input.accessibleOwners, { owner, ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    // Sending one source switches to it and clears the other.
    const movesToCard = input.creditCardId !== undefined;
    const movesToAccount = input.accountId !== undefined;
    const targetAccountId = movesToCard
      ? undefined
      : (input.accountId ?? transaction.accountId ?? undefined);
    const targetCardId = movesToAccount
      ? undefined
      : (input.creditCardId ?? transaction.creditCardId ?? undefined);
    const sourceChanged =
      (movesToAccount && input.accountId !== transaction.accountId) ||
      (movesToCard && input.creditCardId !== transaction.creditCardId);

    const { card } = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: targetAccountId,
      blockArchivedAccount: sourceChanged,
      categoryId: input.categoryId ?? transaction.categoryId,
      creditCardId: targetCardId,
      owner,
      ownerId,
      type: input.type ?? transaction.type,
    });

    const needsInvoiceMonth = card !== undefined && (sourceChanged || input.date !== undefined);
    let invoiceMonth: null | string | undefined;

    if (card && needsInvoiceMonth) {
      invoiceMonth = invoiceMonthOf(input.date ?? transaction.date, card.closingDay);
    } else if (!card && transaction.creditCardId) {
      invoiceMonth = null;
    }

    const updated = await this.transactionRepository.updateTransaction({
      accountId: movesToAccount ? input.accountId : clearedWhen(movesToCard),
      categoryId: input.categoryId,
      creditCardId: movesToCard ? input.creditCardId : clearedWhen(movesToAccount),
      date: input.date,
      description: input.description,
      id: input.id,
      invoiceMonth,
      owner: input.owner,
      ownerId: input.ownerId,
      type: input.type,
      value: input.value,
    });

    if (!card) {
      return { overLimit: false, transaction: updated };
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    return { overLimit: data.invoices.used > card.limit, transaction: updated };
  }
}

// Sending one source clears the other column; otherwise it stays untouched.
function clearedWhen(cleared: boolean): null | undefined {
  return cleared ? null : undefined;
}
