import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PayInvoiceInput, PayInvoiceSchema } from '@finance/application/dto/PayInvoice';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import InvoicePaymentEntity from '@finance/domain/entity/InvoicePaymentEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  INVOICE_PAYMENT_DESCRIPTION,
  SYSTEM_CATEGORY_IDS,
} from '@finance/domain/entity/SystemCategory';
import {
  AccountStatus,
  InvoicePaymentMethod,
  InvoiceStatus,
  SystemCategoryKey,
} from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
  IFinanceInvoicePaymentRepository,
} from '@finance/domain/repository';
import { buildInvoiceFor } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Pays the WHOLE amount of a closed invoice (spec 029 FR 17-20). The amount comes from the stored
// purchases, never from the caller; the datasource re-checks it inside the card lock.
export class PayInvoiceUseCase implements UseCaseWithParams<PayInvoiceInput, InvoicePaymentEntity> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceInvoicePaymentRepository')
    private readonly invoicePaymentRepository: IFinanceInvoicePaymentRepository,
  ) {}

  async execute(params: PayInvoiceInput): Promise<InvoicePaymentEntity> {
    const input = validate(PayInvoiceSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });
    const invoice = buildInvoiceFor(
      card,
      input.invoiceMonth,
      data.totals,
      data.payments,
      input.today,
    );

    if (invoice.payment) {
      throw new ConflictException('Invoice already paid');
    }
    if (invoice.status !== InvoiceStatus.CLOSED || invoice.amount <= 0) {
      throw new UnprocessableEntityException('Only a closed invoice with an amount can be paid');
    }

    let accountOwner;

    if (input.method === InvoicePaymentMethod.ACCOUNT) {
      const account = await this.accountRepository.findAccountById(input.accountId as string);

      if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
        throw new NotFoundException('Account not found');
      }
      if (account.status === AccountStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Account is archived');
      }

      accountOwner = { owner: account.owner, ownerId: account.ownerId };
    }

    return this.invoicePaymentRepository.payInvoice({
      accountId: input.accountId,
      accountOwner,
      amount: invoice.amount,
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVOICE_PAYMENT],
      creditCardId: card.id,
      description: INVOICE_PAYMENT_DESCRIPTION,
      invoiceMonth: input.invoiceMonth,
      method: input.method,
      owner: card.owner,
      ownerId: card.ownerId,
      paidOn: input.paidOn,
    });
  }
}
