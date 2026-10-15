import { Inject } from '@nestjs/common';

import {
  GetInvoicesForListInput,
  GetInvoicesForListSchema,
} from '@finance/application/dto/GetInvoicesForList';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { InvoiceDetail } from '@finance/application/use-case/GetInvoiceUseCase';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { buildInvoiceFor } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// The invoices with an amount whose list day (real payment day once paid, else the planned one)
// falls in `month`, each with its purchases (spec 029 FR 24). Archived cards are included.
export class GetInvoicesForListUseCase implements UseCaseWithParams<
  GetInvoicesForListInput,
  InvoiceDetail[]
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetInvoicesForListInput): Promise<InvoiceDetail[]> {
    const input = validate(GetInvoicesForListSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const cards = await this.creditCardRepository.findCreditCards(owners);
    const data = await this.computeCardInvoicesUseCase.execute({ cards, today: input.today });

    const matches = data.flatMap((item) => {
      const months = new Set([
        ...item.payments.map((payment) => payment.referenceMonth),
        ...item.totals.map((total) => total.invoiceMonth),
      ]);

      return [...months]
        .map((month) => buildInvoiceFor(item.card, month, item.totals, item.payments, input.today))
        .filter((invoice) => invoice.amount > 0 && invoice.listDate.slice(0, 7) === input.month)
        .map((invoice) => ({ card: item.card, invoice }));
    });

    if (matches.length === 0) {
      return [];
    }

    const purchases = await this.transactionRepository.findCardPurchases(
      matches.map(({ card, invoice }) => ({
        creditCardId: card.id,
        invoiceMonth: invoice.referenceMonth,
      })),
    );

    return matches
      .map(({ card, invoice }) => ({
        card,
        invoice,
        purchases: purchases.filter(
          (purchase) =>
            purchase.creditCardId === card.id && purchase.invoiceMonth === invoice.referenceMonth,
        ),
      }))
      .sort(
        (a, b) =>
          a.invoice.listDate.localeCompare(b.invoice.listDate) ||
          a.card.title.localeCompare(b.card.title),
      );
  }
}
