import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';

import {
  EnsureTransactionConsistencyInput,
  EnsureTransactionConsistencySchema,
} from '@finance/application/dto/EnsureTransactionConsistency';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository, IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Cross-record rules shared by create and update: the account and the category must exist, be
// accessible, belong to the SAME owner as the transaction, and the category type must match.
export class EnsureTransactionConsistencyUseCase implements UseCaseWithParams<
  EnsureTransactionConsistencyInput,
  void
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: EnsureTransactionConsistencyInput): Promise<void> {
    const input = validate(EnsureTransactionConsistencySchema, params);

    const account = await this.accountRepository.findAccountById(input.accountId);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException('Account not found');
    }

    const category = await this.categoryRepository.findCategoryById(input.categoryId);

    if (!category || !hasOwnerAccess(input.accessibleOwners, category)) {
      throw new NotFoundException('Category not found');
    }

    if (account.owner !== input.owner || account.ownerId !== input.ownerId) {
      throw new BadRequestException('Account belongs to another owner');
    }

    if (category.owner !== input.owner || category.ownerId !== input.ownerId) {
      throw new BadRequestException('Category belongs to another owner');
    }

    if (category.type !== input.type) {
      throw new BadRequestException('Category type does not match the transaction type');
    }
  }
}
