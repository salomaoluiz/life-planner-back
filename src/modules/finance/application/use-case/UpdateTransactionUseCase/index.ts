import {
  BadRequestException,
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
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InstallmentEditScope, SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import {
  IFinanceInstallmentPlanRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const CARD_FOLLOWS_INVOICE = 'Card purchases follow their invoice';

type ParsedUpdateInput = ReturnType<typeof UpdateTransactionSchema.parse>;

export class UpdateTransactionUseCase implements UseCaseWithParams<
  UpdateTransactionInput,
  TransactionWithLimit
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly installmentPlanRepository: IFinanceInstallmentPlanRepository,
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

    if (transaction.installmentPlanId) {
      return this.updateInstallment(input, transaction);
    }
    if (transaction.recurrenceId) {
      assertRecurringEdit(input);
    } else if (input.scope !== undefined) {
      throw new BadRequestException(
        'Scope only applies to installments and recurring transactions',
      );
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
      blockArchivedCategory:
        input.categoryId !== undefined && input.categoryId !== transaction.categoryId,
      categoryId: input.categoryId ?? transaction.categoryId,
      creditCardId: targetCardId,
      currency: transaction.currency,
      owner,
      ownerId,
      type: input.type ?? transaction.type,
    });

    if (card && input.paid !== undefined) {
      throw new UnprocessableEntityException(CARD_FOLLOWS_INVOICE);
    }

    const needsInvoiceMonth = card !== undefined && (sourceChanged || input.date !== undefined);
    let invoiceMonth: null | string | undefined;

    if (card && needsInvoiceMonth) {
      invoiceMonth = invoiceMonthOf(input.date ?? transaction.date, card.closingDay);
    } else if (!card && transaction.creditCardId) {
      invoiceMonth = null;
    }

    // Paying an unpaid account row moves its date to the payment day unless the body names one (FR 6).
    const paying =
      Boolean(transaction.accountId) && !card && input.paid === true && !transaction.paid;

    const updated = await this.transactionRepository.updateTransaction({
      accountId: movesToAccount ? input.accountId : clearedWhen(movesToCard),
      categoryId: input.categoryId,
      creditCardId: movesToCard ? input.creditCardId : clearedWhen(movesToAccount),
      date: paying ? (input.date ?? input.today) : input.date,
      description: input.description,
      id: input.id,
      invoiceMonth,
      owner: input.owner,
      ownerId: input.ownerId,
      paid: paidFor(input, transaction, card !== undefined),
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

  // Spec 030 FR 11-17: an installment changes only value, description and category, for the rows `scope` names.
  private async updateInstallment(
    input: ParsedUpdateInput,
    transaction: TransactionEntity,
  ): Promise<TransactionWithLimit> {
    if (input.paid !== undefined) {
      throw new UnprocessableEntityException(CARD_FOLLOWS_INVOICE);
    }
    if (input.accountId !== undefined || input.creditCardId !== undefined) {
      throw new UnprocessableEntityException('Edit the installment plan instead');
    }
    if (input.scope === undefined) {
      throw new BadRequestException('scope is required for installments');
    }
    if (
      input.date !== undefined ||
      input.owner !== undefined ||
      input.ownerId !== undefined ||
      input.type !== undefined
    ) {
      throw new BadRequestException('Only value, description and category can change here');
    }

    const consistency = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      blockArchivedAccount: false,
      blockArchivedCategory:
        input.categoryId !== undefined && input.categoryId !== transaction.categoryId,
      categoryId: input.categoryId ?? transaction.categoryId,
      creditCardId: transaction.creditCardId as string,
      currency: transaction.currency,
      owner: transaction.owner,
      ownerId: transaction.ownerId,
      type: TransactionType.EXPENSE,
    });
    // The transaction has a credit card id, so the consistency check resolves the card.
    const card = consistency.card as CreditCardEntity;
    let updated: TransactionEntity;

    if (input.scope === InstallmentEditScope.ONLY_THIS) {
      updated = await this.transactionRepository.updateTransaction({
        categoryId: input.categoryId,
        description: input.description,
        id: input.id,
        value: input.value,
      });
    } else {
      await this.installmentPlanRepository.updateFromNumber({
        categoryId: input.categoryId,
        description: input.description,
        fromNumber: transaction.installmentNumber as number,
        planId: transaction.installmentPlanId as string,
        value: input.value,
      });
      updated = (await this.transactionRepository.findTransactionById(
        input.id,
      )) as TransactionEntity;
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    return { overLimit: data.invoices.used > card.limit, transaction: updated };
  }
}

// Spec 034 FR 21: paying (± a date) needs no scope; any other change on a recurring row is ONLY_THIS.
function assertRecurringEdit(input: ParsedUpdateInput): void {
  const onlyPaying =
    input.paid !== undefined &&
    input.accountId === undefined &&
    input.categoryId === undefined &&
    input.creditCardId === undefined &&
    input.description === undefined &&
    input.owner === undefined &&
    input.ownerId === undefined &&
    input.type === undefined &&
    input.value === undefined;

  if (onlyPaying) {
    return;
  }
  if (input.owner !== undefined || input.ownerId !== undefined) {
    throw new UnprocessableEntityException('Owner cannot change on a recurring transaction');
  }
  if (input.scope === undefined) {
    throw new UnprocessableEntityException('Choose the edit scope');
  }
  if (input.scope === InstallmentEditScope.THIS_AND_NEXT) {
    throw new UnprocessableEntityException('Use the recurrence split');
  }
  if (
    input.accountId !== undefined ||
    input.creditCardId !== undefined ||
    input.type !== undefined
  ) {
    throw new BadRequestException(
      'Only value, description, category, date and paid can change here',
    );
  }
}

// Moving to a card clears the status; coming back from a card needs one (CHECK paid IS NOT NULL).
function paidFor(
  input: ParsedUpdateInput,
  transaction: TransactionEntity,
  toCard: boolean,
): boolean | null | undefined {
  if (toCard) {
    return transaction.accountId ? null : undefined;
  }
  if (transaction.creditCardId) {
    return input.paid ?? (input.date ?? transaction.date) <= input.today;
  }

  return input.paid;
}

// Sending one source clears the other column; otherwise it stays untouched.
function clearedWhen(cleared: boolean): null | undefined {
  return cleared ? null : undefined;
}
