import { Injectable } from '@nestjs/common';

import {
  CreateTransactionApiInput,
  TransactionOutput,
  UpdateTransactionApiInput,
} from '@api/finance/v1/dto/transaction.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';

function toTransactionOutput(transaction: TransactionEntity): TransactionOutput {
  return {
    account: {
      icon: transaction.account.icon,
      id: transaction.account.id,
      name: transaction.account.name,
    },
    accountId: transaction.accountId,
    category: {
      icon: transaction.category.icon,
      iconColor: transaction.category.iconColor,
      id: transaction.category.id,
      name: transaction.category.name,
    },
    categoryId: transaction.categoryId,
    createdAt: transaction.createdAt.toISOString(),
    date: transaction.date,
    description: transaction.description,
    id: transaction.id,
    owner: transaction.owner,
    ownerId: transaction.ownerId,
    type: transaction.type,
    updatedAt: transaction.updatedAt.toISOString(),
    value: transaction.value,
  };
}

@Injectable()
export class TransactionService {
  constructor(
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly deleteTransactionUseCase: DeleteTransactionUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getTransactionsUseCase: GetTransactionsUseCase,
    private readonly updateTransactionUseCase: UpdateTransactionUseCase,
  ) {}

  async create(userId: string, input: CreateTransactionApiInput): Promise<TransactionOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const transaction = await this.createTransactionUseCase.execute({ ...input, accessibleOwners });

    return toTransactionOutput(transaction);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteTransactionUseCase.execute({ accessibleOwners, id });
  }

  async findAll(userId: string, ownerIds?: string[]): Promise<TransactionOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const transactions = await this.getTransactionsUseCase.execute({ accessibleOwners, ownerIds });

    return transactions.map((transaction) => toTransactionOutput(transaction));
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTransactionApiInput,
  ): Promise<TransactionOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const transaction = await this.updateTransactionUseCase.execute({
      ...input,
      accessibleOwners,
      id,
    });

    return toTransactionOutput(transaction);
  }
}
