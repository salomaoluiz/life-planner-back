import { Injectable } from '@nestjs/common';

import {
  CreateTransactionApiInput,
  TransactionOutput,
  UpdateTransactionApiInput,
} from '@api/finance/v1/dto/transaction.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday } from '@api/finance/v1/finance-query';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionSource } from '@finance/domain/enum';

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
    date: transaction.date,
    description: transaction.description,
    id: transaction.id,
    installmentCount: transaction.installmentCount,
    installmentNumber: transaction.installmentNumber,
    installmentPlanId: transaction.installmentPlanId,
    invoiceMonth: transaction.invoiceMonth,
    overLimit,
    owner: transaction.owner,
    ownerId: transaction.ownerId,
    type: transaction.type,
    updatedAt: transaction.updatedAt.toISOString(),
    value: transaction.value,
  };
}

export { toTransactionOutput };

@Injectable()
export class TransactionService {
  constructor(
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly deleteTransactionUseCase: DeleteTransactionUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getTransactionsUseCase: GetTransactionsUseCase,
    private readonly updateTransactionUseCase: UpdateTransactionUseCase,
  ) {}

  async create(
    userId: string,
    input: CreateTransactionApiInput,
    today?: string,
  ): Promise<TransactionOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const { overLimit, transaction } = await this.createTransactionUseCase.execute({
      ...input,
      accessibleOwners,
      today: resolveToday(today),
    });

    return toTransactionOutput(transaction, transaction.creditCardId ? overLimit : undefined);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteTransactionUseCase.execute({ accessibleOwners, id });
  }

  async findAll(
    userId: string,
    ownerIds?: string[],
    filter: { creditCardId?: string; invoiceMonth?: string; source?: TransactionSource } = {},
  ): Promise<TransactionOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const transactions = await this.getTransactionsUseCase.execute({
      accessibleOwners,
      ownerIds,
      ...filter,
    });

    return transactions.map((transaction) => toTransactionOutput(transaction));
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTransactionApiInput,
    today?: string,
  ): Promise<TransactionOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const { overLimit, transaction } = await this.updateTransactionUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      today: resolveToday(today),
    });

    return toTransactionOutput(transaction, transaction.creditCardId ? overLimit : undefined);
  }
}
