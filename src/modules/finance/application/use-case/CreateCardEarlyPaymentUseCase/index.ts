import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  CreateCardEarlyPaymentInput,
  CreateCardEarlyPaymentSchema,
} from '@finance/application/dto/CreateCardEarlyPayment';
import { ACCOUNT_CARD_CURRENCY_MISMATCH } from '@finance/application/service/PaymentAccount';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { AccountStatus, InvoicePaymentMethod, SystemCategoryKey } from '@finance/domain/enum';
import {
  CardCreditAccount,
  IFinanceAccountRepository,
  IFinanceCardCreditRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { buildInvoiceFor, isInvoiceAssignable } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Pays part (or all) of an open or closed unpaid invoice before the Pay flow, from an account or by boleto (spec 032 FR 29-33).
export class CreateCardEarlyPaymentUseCase implements UseCaseWithParams<
  CreateCardEarlyPaymentInput,
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
  ) {}

  async execute(params: CreateCardEarlyPaymentInput): Promise<TransactionEntity> {
    const input = validate(CreateCardEarlyPaymentSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }
    if (input.date > input.today) {
      throw new BadRequestException('The date cannot be after today');
    }
    if (card.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Credit card is archived');
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    if (!isInvoiceAssignable(card, input.invoiceMonth, data.payments, input.today)) {
      throw new UnprocessableEntityException('Invoice is paid or not open yet');
    }

    const invoice = buildInvoiceFor(
      card,
      input.invoiceMonth,
      data.totals,
      data.payments,
      input.today,
    );

    if (input.value > invoice.amountDue) {
      throw new UnprocessableEntityException("The value can't exceed what is left to pay");
    }

    let account: CardCreditAccount | undefined;

    if (input.method === InvoicePaymentMethod.ACCOUNT) {
      const found = await this.accountRepository.findAccountById(input.accountId as string);

      if (!found || !hasOwnerAccess(input.accessibleOwners, found)) {
        throw new NotFoundException('Account not found');
      }
      if (found.status === AccountStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Account is archived');
      }

      if (found.currency !== card.currency) {
        throw new UnprocessableEntityException(ACCOUNT_CARD_CURRENCY_MISMATCH);
      }

      account = { id: found.id, owner: found.owner, ownerId: found.ownerId };
    }

    return this.cardCreditRepository.createEarlyPayment({
      account,
      accountCategoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVOICE_PAYMENT],
      accountDescription: `Early payment · ${card.title} (${input.invoiceMonth})`,
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT],
      creditCardId: card.id,
      currency: card.currency,
      date: input.date,
      description: input.description,
      expectedNet: invoice.net,
      invoiceMonth: input.invoiceMonth,
      method: input.method,
      owner: card.owner,
      ownerId: card.ownerId,
      value: input.value,
    });
  }
}
