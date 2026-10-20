import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  UpdateCardEarlyPaymentInput,
  UpdateCardEarlyPaymentSchema,
} from '@finance/application/dto/UpdateCardEarlyPayment';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { ACCOUNT_CARD_CURRENCY_MISMATCH } from '@finance/application/service/PaymentAccount';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { AccountStatus, InvoicePaymentMethod, SystemCategoryKey } from '@finance/domain/enum';
import {
  CardCreditAccount,
  IFinanceAccountRepository,
  IFinanceCardCreditRepository,
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { buildInvoiceFor, isInvoiceAssignable } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Edit of an early payment: everything while the invoice has no payment record, only the description after (spec 032 FR 34, 40).
export class UpdateCardEarlyPaymentUseCase implements UseCaseWithParams<
  UpdateCardEarlyPaymentInput,
  TransactionEntity
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCardCreditRepository')
    private readonly cardCreditRepository: IFinanceCardCreditRepository,
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: UpdateCardEarlyPaymentInput): Promise<TransactionEntity> {
    const input = validate(UpdateCardEarlyPaymentSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, card);

    const payment = await this.transactionRepository.findTransactionById(input.id);

    if (
      !payment ||
      payment.creditCardId !== card.id ||
      payment.category.systemKey !== SystemCategoryKey.CARD_EARLY_PAYMENT
    ) {
      throw new NotFoundException();
    }

    const onlyDescription =
      input.accountId === undefined &&
      input.date === undefined &&
      input.invoiceMonth === undefined &&
      input.method === undefined &&
      input.value === undefined;

    if (input.date !== undefined && input.date > input.today) {
      throw new BadRequestException('The date cannot be after today');
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });
    const storedMonth = payment.invoiceMonth as string;

    if (data.payments.some((item) => item.referenceMonth === storedMonth)) {
      if (!onlyDescription) {
        throw new UnprocessableEntityException('Invoice is paid');
      }

      return this.cardCreditRepository.updateEarlyPayment({
        description: input.description,
        id: payment.id,
      });
    }

    const month = input.invoiceMonth ?? storedMonth;
    const sameMonth = month === storedMonth;

    if (!sameMonth && !isInvoiceAssignable(card, month, data.payments, input.today)) {
      throw new UnprocessableEntityException('Invoice is paid or not open yet');
    }

    const invoice = buildInvoiceFor(card, month, data.totals, data.payments, input.today);
    // The payment's own value is part of this invoice's total again while it is being edited.
    const cap = Math.max(0, invoice.total + (sameMonth ? payment.value : 0));
    const value = input.value ?? payment.value;

    if (value > cap) {
      throw new UnprocessableEntityException("The value can't exceed what is left to pay");
    }

    const method = input.method ?? (payment.paymentMethod as InvoicePaymentMethod);
    const account = await this.resolveAccount(input, payment, method);

    return this.cardCreditRepository.updateEarlyPayment({
      account,
      accountDescription: `Early payment · ${card.title} (${month})`,
      date: input.date,
      description: input.description,
      expectedNet: invoice.net,
      id: payment.id,
      invoiceMonth: input.invoiceMonth,
      method: input.method,
      value: input.value,
    });
  }

  // The account of the debit row: checked only WHEN it changes, so an archived account keeps its payment editable (FR 40).
  private async resolveAccount(
    input: { accessibleOwners: OwnerAccess[]; accountId?: string },
    payment: TransactionEntity,
    method: InvoicePaymentMethod,
  ): Promise<CardCreditAccount | undefined> {
    if (method === InvoicePaymentMethod.EXTERNAL) {
      if (input.accountId !== undefined) {
        throw new BadRequestException('accountId is forbidden for EXTERNAL payments');
      }

      return undefined;
    }

    const accountId = input.accountId ?? payment.paidFromAccountId;

    if (!accountId) {
      throw new BadRequestException('accountId is required for ACCOUNT payments');
    }
    if (accountId === payment.paidFromAccountId && payment.paymentMethod === method) {
      return undefined;
    }

    const account = await this.accountRepository.findAccountById(accountId);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException('Account not found');
    }
    if (account.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Account is archived');
    }
    if (account.currency !== payment.currency) {
      throw new UnprocessableEntityException(ACCOUNT_CARD_CURRENCY_MISMATCH);
    }

    return { id: account.id, owner: account.owner, ownerId: account.ownerId };
  }
}
