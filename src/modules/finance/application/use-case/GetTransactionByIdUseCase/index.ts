import { Inject, NotFoundException } from '@nestjs/common';

import {
  GetTransactionByIdInput,
  GetTransactionByIdSchema,
} from '@finance/application/dto/GetTransactionById';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 077: one row for the edit form; a row the caller cannot read is a 404, like update and delete.
export class GetTransactionByIdUseCase implements UseCaseWithParams<
  GetTransactionByIdInput,
  TransactionEntity
> {
  constructor(
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetTransactionByIdInput): Promise<TransactionEntity> {
    const input = validate(GetTransactionByIdSchema, params);

    const transaction = await this.transactionRepository.findTransactionById(input.id);

    if (!transaction || !hasOwnerAccess(input.accessibleOwners, transaction)) {
      throw new NotFoundException();
    }

    return transaction;
  }
}
