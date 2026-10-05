import { Inject } from '@nestjs/common';

import {
  GetTransactionsInput,
  GetTransactionsSchema,
} from '@finance/application/dto/GetTransactions';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class GetTransactionsUseCase implements UseCaseWithParams<
  GetTransactionsInput,
  TransactionEntity[]
> {
  constructor(
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetTransactionsInput): Promise<TransactionEntity[]> {
    const input = validate(GetTransactionsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    return this.transactionRepository.findTransactions(owners);
  }
}
