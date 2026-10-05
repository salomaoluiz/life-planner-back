import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import {
  UpdateTransactionInput,
  UpdateTransactionSchema,
} from '@finance/application/dto/UpdateTransaction';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateTransactionUseCase implements UseCaseWithParams<
  UpdateTransactionInput,
  TransactionEntity
> {
  constructor(
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: UpdateTransactionInput): Promise<TransactionEntity> {
    const input = validate(UpdateTransactionSchema, params);

    const transaction = await this.transactionRepository.findTransactionById(input.id);

    if (!transaction || !hasOwnerAccess(input.accessibleOwners, transaction)) {
      throw new NotFoundException();
    }

    // The rules are checked against the resulting record (patch merged over the stored one).
    const owner = input.owner ?? transaction.owner;
    const ownerId = input.ownerId ?? transaction.ownerId;

    if (!hasOwnerAccess(input.accessibleOwners, { owner, ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: input.accountId ?? transaction.accountId,
      categoryId: input.categoryId ?? transaction.categoryId,
      owner,
      ownerId,
      type: input.type ?? transaction.type,
    });

    return this.transactionRepository.updateTransaction({
      accountId: input.accountId,
      categoryId: input.categoryId,
      date: input.date,
      description: input.description,
      id: input.id,
      owner: input.owner,
      ownerId: input.ownerId,
      type: input.type,
      value: input.value,
    });
  }
}
