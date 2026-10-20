import { Inject } from '@nestjs/common';

import {
  ResolveCardRowsPaidInput,
  ResolveCardRowsPaidSchema,
} from '@finance/application/dto/ResolveCardRowsPaid';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InvoiceStatus } from '@finance/domain/enum';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import { buildInvoiceFor } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// A card row has no status of its own: it is paid when its invoice is paid or settled (spec 033 FR 2).
// Account rows come back untouched; the cards and their invoices are read once for the whole list.
export class ResolveCardRowsPaidUseCase implements UseCaseWithParams<
  ResolveCardRowsPaidInput,
  TransactionEntity[]
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: ResolveCardRowsPaidInput): Promise<TransactionEntity[]> {
    const input = validate(ResolveCardRowsPaidSchema, params);
    const cardIds = [
      ...new Set(input.transactions.map((row) => row.creditCardId).filter((id) => id !== null)),
    ];

    if (cardIds.length === 0) {
      return input.transactions;
    }

    const found = await Promise.all(
      cardIds.map(async (id) => this.creditCardRepository.findCreditCardById(id)),
    );
    const cards = found.filter((card) => card !== undefined);
    const data = await this.computeCardInvoicesUseCase.execute({ cards, today: input.today });
    const byCard = new Map(data.map((item) => [item.card.id, item]));

    const resolved = input.transactions.map((row) => {
      const item = row.creditCardId ? byCard.get(row.creditCardId) : undefined;

      if (!item || !row.invoiceMonth) {
        return row;
      }

      const invoice = buildInvoiceFor(
        item.card,
        row.invoiceMonth,
        item.totals,
        item.payments,
        input.today,
      );

      return { ...row, paid: invoice.status === InvoiceStatus.PAID };
    });

    return input.paid === undefined
      ? resolved
      : resolved.filter((row) => !row.creditCardId || row.paid === input.paid);
  }
}
