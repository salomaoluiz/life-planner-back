import { Inject } from '@nestjs/common';

import {
  GetCreditCardsOverviewInput,
  GetCreditCardsOverviewSchema,
} from '@finance/application/dto/GetCreditCardsOverview';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import { addInvoiceMonths, Invoice } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const OVERVIEW_PAID_WINDOW_MONTHS = 3;

export interface CreditCardOverviewItem {
  available: number;
  card: CreditCardEntity;
  closedInvoices: Invoice[];
  openInvoice: Invoice;
  // Spec 096: projected purchases of the unpaid invoices; `available` already subtracts them.
  projectedUsed: number;
  upcomingInvoices: Invoice[];
  used: number;
}
export interface CreditCardsOverview {
  aggregate: { available: number; projectedUsed: number; totalLimit: number; used: number };
  cards: CreditCardOverviewItem[];
}

export class GetCreditCardsOverviewUseCase implements UseCaseWithParams<
  GetCreditCardsOverviewInput,
  CreditCardsOverview
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: GetCreditCardsOverviewInput): Promise<CreditCardsOverview> {
    const input = validate(GetCreditCardsOverviewSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return toOverview([]);
    }

    const cards = await this.creditCardRepository.findCreditCards(owners, AccountStatus.ACTIVE);
    const sorted = [...cards].sort((a, b) =>
      a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
    );
    const data = await this.computeCardInvoicesUseCase.execute({
      cards: sorted,
      // Spec 091: the overview lists the open invoice, the unpaid ones and the recent-paid window (3 months back).
      fromMonth: addInvoiceMonths(input.today.slice(0, 7), -OVERVIEW_PAID_WINDOW_MONTHS),
      today: input.today,
    });
    const items = data.map(({ card, invoices }) => ({
      available: invoices.available,
      card,
      closedInvoices: invoices.closedInvoices,
      openInvoice: invoices.openInvoice,
      projectedUsed: invoices.projectedUsed,
      upcomingInvoices: invoices.upcomingInvoices,
      used: invoices.used,
    }));

    return toOverview(items);
  }
}

function toOverview(cards: CreditCardOverviewItem[]): CreditCardsOverview {
  const totalLimit = cards.reduce((sum, item) => sum + item.card.limit, 0);
  const used = cards.reduce((sum, item) => sum + item.used, 0);
  const projectedUsed = cards.reduce((sum, item) => sum + item.projectedUsed, 0);

  return {
    aggregate: { available: totalLimit - used - projectedUsed, projectedUsed, totalLimit, used },
    cards,
  };
}
