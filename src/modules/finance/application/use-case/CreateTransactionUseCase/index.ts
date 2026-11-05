import { ForbiddenException, Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  CreateTransactionInput,
  CreateTransactionSchema,
} from '@finance/application/dto/CreateTransaction';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import {
  CardInvoiceData,
  ComputeCardInvoicesUseCase,
} from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import {
  invoiceMonthOf,
  isOverLimit,
  isPurchaseInvoiceAllowed,
} from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// `overLimit` is true only for a card purchase that leaves the card above its limit (spec 029 FR 11): the write still succeeds.
export interface TransactionWithLimit {
  // Spec 083: the card's invoices computed for `overLimit`, reused by the caller (card rows only).
  invoiceData?: CardInvoiceData[];
  overLimit: boolean;
  transaction: TransactionEntity;
}

export class CreateTransactionUseCase implements UseCaseWithParams<
  CreateTransactionInput,
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

  async execute(params: CreateTransactionInput): Promise<TransactionWithLimit> {
    const input = validate(CreateTransactionSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId });

    if (input.creditCardId !== undefined && input.paid !== undefined) {
      throw new UnprocessableEntityException('Card purchases follow their invoice');
    }

    const { account, card } = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: input.accountId,
      blockArchivedAccount: true,
      blockArchivedCategory: true,
      categoryId: input.categoryId,
      creditCardId: input.creditCardId,
      currency: input.currency,
      owner: input.owner,
      ownerId: input.ownerId,
      type: input.type,
    });

    if (input.invoiceMonth !== undefined) {
      // Spec 095 FR 1, 3: only a card purchase, and only the previous, computed or next invoice of its date.
      // A paid month is refused by the datasource under the card lock (`Invoice is paid`), with no extra query.
      if (!card || !isPurchaseInvoiceAllowed(input.date, card.closingDay, input.invoiceMonth)) {
        throw new UnprocessableEntityException('Invoice is not available for this date');
      }
    }

    const transaction = await this.transactionRepository.createTransaction({
      accountId: input.accountId,
      categoryId: input.categoryId,
      creditCardId: input.creditCardId,
      currency: (card ?? (account as AccountEntity)).currency,
      date: input.date,
      description: input.description,
      invoiceMonth: card
        ? (input.invoiceMonth ?? invoiceMonthOf(input.date, card.closingDay))
        : undefined,
      notes: input.notes,
      owner: input.owner,
      ownerId: input.ownerId,
      // Account rows start paid when dated up to today (ISO dates compare as strings).
      paid: input.accountId === undefined ? undefined : (input.paid ?? input.date <= input.today),
      tags: input.tags,
      type: input.type,
      value: input.value,
    });

    if (!card) {
      return { overLimit: false, transaction };
    }

    const invoiceData = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    return {
      invoiceData,
      overLimit: isOverLimit(invoiceData[0].invoices, card.limit),
      transaction,
    };
  }
}
