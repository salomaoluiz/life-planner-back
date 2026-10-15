import { Inject } from '@nestjs/common';

import {
  GetCreditCardsOverviewInput,
  GetCreditCardsOverviewSchema,
} from '@finance/application/dto/GetCreditCardsOverview';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import {
  calculateInvoices,
  Invoice,
  InvoicePurchase,
} from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface CreditCardOverviewItem {
  available: number;
  card: CreditCardEntity;
  closedInvoices: Invoice[];
  openInvoice: Invoice;
  used: number;
}
export interface CreditCardsOverview {
  aggregate: { available: number; totalLimit: number; used: number };
  cards: CreditCardOverviewItem[];
}

// Purchases do not exist yet (the next spec links transactions to cards): the calculator already takes them as input.
const NO_PURCHASES: InvoicePurchase[] = [];

export class GetCreditCardsOverviewUseCase implements UseCaseWithParams<
  GetCreditCardsOverviewInput,
  CreditCardsOverview
> {
  constructor(
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
    const items = [...cards]
      .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
      .map((card) => {
        const { available, closedInvoices, openInvoice, used } = calculateInvoices(
          card,
          NO_PURCHASES,
          input.today,
        );

        return { available, card, closedInvoices, openInvoice, used };
      });

    return toOverview(items);
  }
}

function toOverview(cards: CreditCardOverviewItem[]): CreditCardsOverview {
  const totalLimit = cards.reduce((sum, item) => sum + item.card.limit, 0);
  const used = cards.reduce((sum, item) => sum + item.used, 0);

  return { aggregate: { available: totalLimit - used, totalLimit, used }, cards };
}
