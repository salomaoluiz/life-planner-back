import { Inject } from '@nestjs/common';

import {
  FindInvoicesInRangeInput,
  FindInvoicesInRangeSchema,
} from '@finance/application/dto/FindInvoicesInRange';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import { buildInvoiceFor, Invoice } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface InvoiceMatch {
  card: CreditCardEntity;
  invoice: Invoice;
}

// The invoices with an amount whose list day (real payment day once paid, else the planned one) is in
// [from, to] (spec 029 FR 24, spec 045 FR 6). Archived cards are included.
export class FindInvoicesInRangeUseCase implements UseCaseWithParams<
  FindInvoicesInRangeInput,
  InvoiceMatch[]
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: FindInvoicesInRangeInput): Promise<InvoiceMatch[]> {
    const input = validate(FindInvoicesInRangeSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const wanted = input.creditCardIds?.length ? new Set(input.creditCardIds) : undefined;
    const cards = (await this.creditCardRepository.findCreditCards(owners)).filter(
      (card) => !wanted || wanted.has(card.id),
    );
    const data = await this.computeCardInvoicesUseCase.execute({ cards, today: input.today });

    return data.flatMap((item) => {
      const months = new Set([
        ...item.payments.map((payment) => payment.referenceMonth),
        ...item.totals.map((total) => total.invoiceMonth),
      ]);

      return [...months]
        .map((month) => buildInvoiceFor(item.card, month, item.totals, item.payments, input.today))
        .filter(
          (invoice) =>
            (invoice.amount > 0 || invoice.earlyPaid > 0) &&
            invoice.listDate >= input.from &&
            invoice.listDate <= input.to,
        )
        .map((invoice) => ({ card: item.card, invoice }));
    });
  }
}
