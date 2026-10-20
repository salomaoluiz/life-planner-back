import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { todayInSaoPaulo } from '@api/finance/v1/credit-card-today';
import {
  CreateCreditCardApiInput,
  CreditCardOutput,
  CreditCardsOverviewOutput,
  InvoiceApiSchema,
  UpdateCreditCardApiInput,
} from '@api/finance/v1/dto/credit-card.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateCreditCardUseCase } from '@finance/application/use-case/CreateCreditCardUseCase';
import { DeleteCreditCardUseCase } from '@finance/application/use-case/DeleteCreditCardUseCase';
import { GetAccountsByIdsUseCase } from '@finance/application/use-case/GetAccountsByIdsUseCase';
import { GetCreditCardByIdUseCase } from '@finance/application/use-case/GetCreditCardByIdUseCase';
import { GetCreditCardsOverviewUseCase } from '@finance/application/use-case/GetCreditCardsOverviewUseCase';
import { GetCreditCardsUseCase } from '@finance/application/use-case/GetCreditCardsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { UpdateCreditCardUseCase } from '@finance/application/use-case/UpdateCreditCardUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { Invoice } from '@finance/domain/service/InvoiceCalculator';

// Account ids are uuid strings; the calculator keeps them as plain strings, so the shape is already the wire shape.
export function toInvoiceOutput(invoice: Invoice): z.infer<typeof InvoiceApiSchema> {
  return invoice;
}

function toCreditCardOutput(
  card: CreditCardEntity,
  accounts: Map<string, AccountEntity>,
): CreditCardOutput {
  const account = card.paymentAccountId ? accounts.get(card.paymentAccountId) : undefined;

  return {
    brand: card.brand,
    closingDay: card.closingDay,
    color: card.color,
    createdAt: card.createdAt.toISOString(),
    currency: card.currency,
    dueDay: card.dueDay,
    id: card.id,
    lastDigits: card.lastDigits,
    limit: card.limit,
    owner: card.owner,
    ownerId: card.ownerId,
    paymentAccount: account
      ? { icon: account.icon, id: account.id, name: account.name, status: account.status }
      : null,
    paymentAccountId: card.paymentAccountId ?? null,
    paymentDay: card.paymentDay,
    status: card.status,
    title: card.title,
    updatedAt: card.updatedAt.toISOString(),
  };
}

@Injectable()
export class CreditCardService {
  constructor(
    private readonly createCreditCardUseCase: CreateCreditCardUseCase,
    private readonly deleteCreditCardUseCase: DeleteCreditCardUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getAccountsByIdsUseCase: GetAccountsByIdsUseCase,
    private readonly getCreditCardByIdUseCase: GetCreditCardByIdUseCase,
    private readonly getCreditCardsOverviewUseCase: GetCreditCardsOverviewUseCase,
    private readonly getCreditCardsUseCase: GetCreditCardsUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
    private readonly updateCreditCardUseCase: UpdateCreditCardUseCase,
  ) {}

  async create(userId: string, input: CreateCreditCardApiInput): Promise<CreditCardOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const card = await this.createCreditCardUseCase.execute({ ...input, accessibleOwners });

    return toCreditCardOutput(card, await this.accountsOf(accessibleOwners, [card]));
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteCreditCardUseCase.execute({ accessibleOwners, id });
  }

  async findAll(
    userId: string,
    ownerIds?: string[],
    status?: AccountStatus,
  ): Promise<CreditCardOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const cards = await this.getCreditCardsUseCase.execute({ accessibleOwners, ownerIds, status });

    const accounts = await this.accountsOf(accessibleOwners, cards);

    return cards.map((card) => toCreditCardOutput(card, accounts));
  }

  async findOne(userId: string, id: string): Promise<CreditCardOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const card = await this.getCreditCardByIdUseCase.execute({ accessibleOwners, id });

    return toCreditCardOutput(card, await this.accountsOf(accessibleOwners, [card]));
  }

  async findOverview(
    userId: string,
    ownerIds?: string[],
    today?: string,
  ): Promise<CreditCardsOverviewOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const resolved = today ?? todayInSaoPaulo();

    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      ownerIds,
      today: resolved,
    });

    const overview = await this.getCreditCardsOverviewUseCase.execute({
      accessibleOwners,
      ownerIds,
      today: resolved,
    });

    const accounts = await this.accountsOf(
      accessibleOwners,
      overview.cards.map((item) => item.card),
    );

    return {
      aggregate: overview.aggregate,
      cards: overview.cards.map((item) => ({
        ...item,
        card: toCreditCardOutput(item.card, accounts),
        closedInvoices: item.closedInvoices.map((invoice) => toInvoiceOutput(invoice)),
        openInvoice: toInvoiceOutput(item.openInvoice),
        upcomingInvoices: item.upcomingInvoices.map((invoice) => toInvoiceOutput(invoice)),
      })),
    };
  }

  async update(
    userId: string,
    id: string,
    input: UpdateCreditCardApiInput,
  ): Promise<CreditCardOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const card = await this.updateCreditCardUseCase.execute({ ...input, accessibleOwners, id });

    return toCreditCardOutput(card, await this.accountsOf(accessibleOwners, [card]));
  }

  // ONE read for every linked account the caller can see; the others stay out of the map (FR 23).
  private async accountsOf(
    accessibleOwners: OwnerAccess[],
    cards: CreditCardEntity[],
  ): Promise<Map<string, AccountEntity>> {
    const ids = cards.flatMap((card) => card.paymentAccountId ?? []);
    const accounts = await this.getAccountsByIdsUseCase.execute({ accessibleOwners, ids });

    return new Map(accounts.map((account) => [account.id, account]));
  }
}
