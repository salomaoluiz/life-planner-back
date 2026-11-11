import { Injectable } from '@nestjs/common';

import {
  ConfirmTransactionApiInput,
  CreateTransactionApiInput,
  TransactionItem,
  TransactionLookups,
  TransactionOutput,
  UpdateTransactionApiInput,
} from '@api/finance/v1/dto/transaction.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday } from '@api/finance/v1/finance-query';
import { TransferLookupsService } from '@api/finance/v1/transfer-lookups.service';
import { ConfirmProjectedTransactionUseCase } from '@finance/application/use-case/ConfirmProjectedTransactionUseCase';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { GetTransactionByIdUseCase } from '@finance/application/use-case/GetTransactionByIdUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { INVESTMENT_KEYS } from '@finance/domain/entity/SystemCategory';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionFilter } from '@finance/domain/entity/TransactionFilter';
import {
  InstallmentEditScope,
  TransactionExternalLock,
  TransactionSource,
} from '@finance/domain/enum';
import { FindIncomeByTransactionIdUseCase } from '@investment/application/use-case/FindIncomeByTransactionIdUseCase';
import { FindOperationByTransactionIdUseCase } from '@investment/application/use-case/FindOperationByTransactionIdUseCase';

function toTransactionOutput(
  transaction: TransactionEntity,
  overLimit?: boolean,
): TransactionOutput {
  return {
    account: transaction.account
      ? {
          icon: transaction.account.icon,
          id: transaction.account.id,
          name: transaction.account.name,
        }
      : null,
    accountId: transaction.accountId,
    category: {
      excludeFromTotals: transaction.category.excludeFromTotals,
      icon: transaction.category.icon,
      iconColor: transaction.category.iconColor,
      id: transaction.category.id,
      name: transaction.category.name,
      systemKey: transaction.category.systemKey,
    },
    categoryId: transaction.categoryId,
    createdAt: transaction.createdAt.toISOString(),
    creditCard: transaction.creditCard
      ? {
          color: transaction.creditCard.color,
          id: transaction.creditCard.id,
          lastDigits: transaction.creditCard.lastDigits,
          title: transaction.creditCard.title,
        }
      : null,
    creditCardId: transaction.creditCardId,
    currency: transaction.currency,
    date: transaction.date,
    description: transaction.description,
    earlyPayment: transaction.earlyPayment,
    externalLock: transaction.externalLock ?? undefined,
    id: transaction.id,
    installmentCount: transaction.installmentCount,
    installmentNumber: transaction.installmentNumber,
    installmentPlanId: transaction.installmentPlanId,
    invoiceMonth: transaction.invoiceMonth,
    notes: transaction.notes,
    occurrenceCount: transaction.occurrenceCount,
    occurrenceNumber: transaction.occurrenceNumber,
    overLimit,
    owner: transaction.owner,
    ownerId: transaction.ownerId,
    paid: transaction.paid,
    projected: transaction.projected,
    recurrenceFrequency: transaction.recurrenceFrequency,
    recurrenceId: transaction.recurrenceId,
    tags: transaction.tags,
    type: transaction.type,
    updatedAt: transaction.updatedAt.toISOString(),
    value: transaction.value,
  };
}

// Spec 079: ids only, no nulls, no timestamps; the referenced entities go to `toTransactionLookups`.
function toTransactionItem(transaction: TransactionEntity, overLimit?: boolean): TransactionItem {
  return {
    accountId: transaction.accountId ?? undefined,
    categoryId: transaction.categoryId,
    creditCardId: transaction.creditCardId ?? undefined,
    currency: transaction.currency,
    date: transaction.date,
    description: transaction.description,
    earlyPayment: transaction.earlyPayment ?? undefined,
    externalLock: transaction.externalLock ?? undefined,
    id: transaction.id,
    installmentCount: transaction.installmentCount ?? undefined,
    installmentNumber: transaction.installmentNumber ?? undefined,
    installmentPlanId: transaction.installmentPlanId ?? undefined,
    invoiceMonth: transaction.invoiceMonth ?? undefined,
    notes: transaction.notes ?? undefined,
    occurrenceCount: transaction.occurrenceCount ?? undefined,
    occurrenceNumber: transaction.occurrenceNumber ?? undefined,
    overLimit,
    owner: transaction.owner,
    ownerId: transaction.ownerId,
    paid: transaction.paid,
    // Lean payload: only a projected row carries the flag.
    projected: transaction.projected ? true : undefined,
    recurrenceFrequency: transaction.recurrenceFrequency ?? undefined,
    recurrenceId: transaction.recurrenceId ?? undefined,
    tagIds: transaction.tags.length > 0 ? transaction.tags.map((tag) => tag.id) : undefined,
    transferId: transaction.transferId ?? undefined,
    type: transaction.type,
    value: transaction.value,
  };
}

// Exactly the entities the given rows reference, each once.
interface TransactionWithLookups {
  // Spec 102 FR 22: the operation behind an investment row, and spec 107 FR 16: the income behind a locked row.
  investment?: { assetId: string; incomeId: string } | { assetId: string; operationId: string };
  item: TransactionItem;
  lookups: TransactionLookups;
}

function toTransactionLookups(transactions: TransactionEntity[]): TransactionLookups {
  const lookups: TransactionLookups = { accounts: {}, categories: {}, creditCards: {}, tags: {} };

  for (const { account, category, creditCard, tags } of transactions) {
    if (account) {
      lookups.accounts[account.id] = { icon: account.icon, name: account.name };
    }

    lookups.categories[category.id] = {
      excludeFromTotals: category.excludeFromTotals ? true : undefined,
      icon: category.icon,
      iconColor: category.iconColor,
      name: category.name,
      systemKey: category.systemKey ?? undefined,
    };

    if (creditCard) {
      lookups.creditCards[creditCard.id] = {
        color: creditCard.color,
        lastDigits: creditCard.lastDigits,
        title: creditCard.title,
      };
    }

    for (const tag of tags) {
      lookups.tags[tag.id] = { name: tag.name };
    }
  }

  return lookups;
}
function toWithLookups(
  transaction: TransactionEntity,
  overLimit?: boolean,
): TransactionWithLookups {
  return {
    item: toTransactionItem(transaction, overLimit),
    lookups: toTransactionLookups([transaction]),
  };
}

export { toTransactionItem, toTransactionLookups, toTransactionOutput };

@Injectable()
export class TransactionService {
  constructor(
    private readonly confirmProjectedTransactionUseCase: ConfirmProjectedTransactionUseCase,
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly deleteTransactionUseCase: DeleteTransactionUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly findIncomeByTransactionIdUseCase: FindIncomeByTransactionIdUseCase,
    private readonly findOperationByTransactionIdUseCase: FindOperationByTransactionIdUseCase,
    private readonly getTransactionByIdUseCase: GetTransactionByIdUseCase,
    private readonly getTransactionsUseCase: GetTransactionsUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
    private readonly resolveCardRowsPaidUseCase: ResolveCardRowsPaidUseCase,
    private readonly transferLookupsService: TransferLookupsService,
    private readonly updateTransactionUseCase: UpdateTransactionUseCase,
  ) {}

  async confirm(
    userId: string,
    id: string,
    input: ConfirmTransactionApiInput,
    today?: string,
  ): Promise<TransactionWithLookups> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const { invoiceData, overLimit, transaction } =
      await this.confirmProjectedTransactionUseCase.execute({
        ...input,
        accessibleOwners,
        id,
        today: resolveToday(today),
      });
    const [resolved] = await this.resolveCardRowsPaidUseCase.execute({
      invoiceData,
      today: resolveToday(today),
      transactions: [transaction],
    });

    return toWithLookups(resolved, transaction.creditCardId ? overLimit : undefined);
  }

  async create(
    userId: string,
    input: CreateTransactionApiInput,
    today?: string,
  ): Promise<TransactionWithLookups> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const { invoiceData, overLimit, transaction } = await this.createTransactionUseCase.execute({
      ...input,
      accessibleOwners,
      today: resolveToday(today),
    });
    const [resolved] = await this.resolveCardRowsPaidUseCase.execute({
      invoiceData,
      today: resolveToday(today),
      transactions: [transaction],
    });

    return toWithLookups(resolved, transaction.creditCardId ? overLimit : undefined);
  }

  async delete(userId: string, id: string, scope?: InstallmentEditScope): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteTransactionUseCase.execute({ accessibleOwners, id, scope });
  }

  async findAll(
    userId: string,
    ownerIds?: string[],
    filter: {
      cursor?: string;
      filter?: TransactionFilter;
      invoiceMonth?: string;
      limit?: number;
      source?: TransactionSource;
    } = {},
    today?: string,
  ): Promise<{ items: TransactionItem[]; lookups: TransactionLookups; nextCursor: null | string }> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    // Real occurrences up to the end of this month exist before the list is read (spec 034 FR 9).
    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      ownerIds,
      today: resolveToday(today),
    });

    const {
      invoiceData,
      items: transactions,
      nextCursor,
    } = await this.getTransactionsUseCase.execute({
      accessibleOwners,
      ownerIds,
      ...filter,
      today: resolveToday(today),
    });

    const resolved = await this.resolveCardRowsPaidUseCase.execute({
      invoiceData,
      paid: filter.filter?.paid,
      today: resolveToday(today),
      transactions,
    });

    return {
      items: resolved.map((transaction) => toTransactionItem(transaction)),
      lookups: await this.transferLookupsService.attach(
        accessibleOwners,
        resolved,
        toTransactionLookups(resolved),
      ),
      nextCursor,
    };
  }

  // Spec 077: one row for the edit form; a card purchase gets its `paid` from its invoice like in the list.
  async findById(userId: string, id: string, today?: string): Promise<TransactionWithLookups> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const transaction = await this.getTransactionByIdUseCase.execute({ accessibleOwners, id });
    const [resolved] = await this.resolveCardRowsPaidUseCase.execute({
      today: resolveToday(today),
      transactions: [transaction],
    });

    const withLookups = toWithLookups(resolved);
    const investment = await this.findInvestmentLink(resolved);

    return {
      ...withLookups,
      ...(investment ? { investment } : {}),
      lookups: await this.transferLookupsService.attach(
        accessibleOwners,
        [resolved],
        withLookups.lookups,
      ),
    };
  }

  // Spec 102 FR 22 and spec 107 FR 16: the operation or income behind an investment row, so the app can open it.
  private async findInvestmentLink(
    row: TransactionEntity,
  ): Promise<TransactionWithLookups['investment']> {
    if (row.externalLock === TransactionExternalLock.INVESTMENT) {
      return this.findIncomeByTransactionIdUseCase.execute({ transactionId: row.id });
    }

    const systemKey = row.category.systemKey;

    return systemKey !== null && INVESTMENT_KEYS.includes(systemKey)
      ? this.findOperationByTransactionIdUseCase.execute({ transactionId: row.id })
      : undefined;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTransactionApiInput,
    today?: string,
  ): Promise<TransactionWithLookups> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const { invoiceData, overLimit, transaction } = await this.updateTransactionUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      today: resolveToday(today),
    });
    const [resolved] = await this.resolveCardRowsPaidUseCase.execute({
      invoiceData,
      today: resolveToday(today),
      transactions: [transaction],
    });

    return toWithLookups(resolved, transaction.creditCardId ? overLimit : undefined);
  }
}
