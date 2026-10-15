import { Inject } from '@nestjs/common';

import {
  ComputeCardInvoicesInput,
  ComputeCardInvoicesSchema,
} from '@finance/application/dto/ComputeCardInvoices';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import {
  IFinanceInvoicePaymentRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import {
  calculateInvoices,
  CardInvoices,
  InvoicePaymentInfo,
  InvoiceTotal,
} from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface CardInvoiceData {
  card: CreditCardEntity;
  invoices: CardInvoices;
  payments: InvoicePaymentInfo[];
  totals: InvoiceTotal[];
}

// The invoices of several cards from ONE grouped sum query and ONE payments query (no per-card N+1).
export class ComputeCardInvoicesUseCase implements UseCaseWithParams<
  ComputeCardInvoicesInput,
  CardInvoiceData[]
> {
  constructor(
    @Inject('IFinanceInvoicePaymentRepository')
    private readonly invoicePaymentRepository: IFinanceInvoicePaymentRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: ComputeCardInvoicesInput): Promise<CardInvoiceData[]> {
    const input = validate(ComputeCardInvoicesSchema, params);

    if (input.cards.length === 0) {
      return [];
    }

    const cardIds = input.cards.map((card) => card.id);
    const [sums, payments] = await Promise.all([
      this.transactionRepository.sumCardInvoices(cardIds),
      this.invoicePaymentRepository.findByCardIds(cardIds),
    ]);

    return input.cards.map((card) => {
      const totals = sums
        .filter((sum) => sum.creditCardId === card.id)
        .map((sum) => ({ amount: sum.amount, invoiceMonth: sum.invoiceMonth }));
      const cardPayments = payments
        .filter((payment) => payment.creditCardId === card.id)
        .map((payment) => ({
          accountId: payment.accountId,
          accountName: payment.accountName,
          amount: payment.amount,
          method: payment.method,
          paidOn: payment.paidOn,
          referenceMonth: payment.invoiceMonth,
        }));

      return {
        card,
        invoices: calculateInvoices(card, totals, cardPayments, input.today),
        payments: cardPayments,
        totals,
      };
    });
  }
}
