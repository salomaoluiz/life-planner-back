import { ForbiddenException, Inject } from '@nestjs/common';

import {
  CreateTransactionInput,
  CreateTransactionSchema,
} from '@finance/application/dto/CreateTransaction';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateTransactionUseCase implements UseCaseWithParams<
  CreateTransactionInput,
  TransactionEntity
> {
  constructor(
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: CreateTransactionInput): Promise<TransactionEntity> {
    const input = validate(CreateTransactionSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: input.accountId,
      categoryId: input.categoryId,
      owner: input.owner,
      ownerId: input.ownerId,
      type: input.type,
    });

    return this.transactionRepository.createTransaction({
      accountId: input.accountId,
      categoryId: input.categoryId,
      date: input.date,
      description: input.description,
      owner: input.owner,
      ownerId: input.ownerId,
      type: input.type,
      value: input.value,
    });
  }
}
