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
import { Invoice } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface CreditCardOverviewItem {
  available: number;
  card: CreditCardEntity;
  closedInvoices: Invoice[];
  openInvoice: Invoice;
  upcomingInvoices: Invoice[];
  used: number;
}
export interface CreditCardsOverview {
  aggregate: { available: number; totalLimit: number; used: number };
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
      today: input.today,
    });
    const items = data.map(({ card, invoices }) => ({
      available: invoices.available,
      card,
      closedInvoices: invoices.closedInvoices,
      openInvoice: invoices.openInvoice,
      upcomingInvoices: invoices.upcomingInvoices,
      used: invoices.used,
    }));

    return toOverview(items);
  }
}

function toOverview(cards: CreditCardOverviewItem[]): CreditCardsOverview {
  const totalLimit = cards.reduce((sum, item) => sum + item.card.limit, 0);
  const used = cards.reduce((sum, item) => sum + item.used, 0);

  return { aggregate: { available: totalLimit - used, totalLimit, used }, cards };
}
