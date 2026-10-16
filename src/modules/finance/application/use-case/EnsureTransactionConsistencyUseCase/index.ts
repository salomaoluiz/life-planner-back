import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  EnsureTransactionConsistencyInput,
  EnsureTransactionConsistencySchema,
} from '@finance/application/dto/EnsureTransactionConsistency';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { isSystemCategoryId } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, TransactionType } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceCategoryRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

// Cross-record rules shared by create and update: the account and the category must exist, be
// accessible, belong to the SAME owner as the transaction, and the category type must match.
// The category must not be a system category, and a transaction may not be put on an archived
// account when the caller asks (create / move).
export interface ConsistencyResult {
  // Set when the transaction is a card purchase.
  card?: CreditCardEntity;
}

export class EnsureTransactionConsistencyUseCase implements UseCaseWithParams<
  EnsureTransactionConsistencyInput,
  ConsistencyResult
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  private async ensureAccount(
    accountId: string,
    input: {
      accessibleOwners: OwnerAccess[];
      blockArchivedAccount: boolean;
      owner: OwnerType;
      ownerId: string;
    },
  ): Promise<undefined> {
    const account = await this.accountRepository.findAccountById(accountId);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException('Account not found');
    }

    if (input.blockArchivedAccount && account.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Account is archived');
    }

    if (account.owner !== input.owner || account.ownerId !== input.ownerId) {
      throw new BadRequestException('Account belongs to another owner');
    }

    return undefined;
  }

  async execute(params: EnsureTransactionConsistencyInput): Promise<ConsistencyResult> {
    const input = validate(EnsureTransactionConsistencySchema, params);

    // Reserved ids are recognised without a lookup: only the feature that owns them may write them.
    if (isSystemCategoryId(input.categoryId)) {
      throw new UnprocessableEntityException('System category is reserved');
    }

    const card = input.creditCardId
      ? await this.ensureCard(input.creditCardId, input)
      : await this.ensureAccount(input.accountId as string, input);

    // The category check below runs for both sources.

    const category = await this.categoryRepository.findCategoryById(input.categoryId);

    if (!category || !hasOwnerAccess(input.accessibleOwners, category)) {
      throw new NotFoundException('Category not found');
    }

    if (category.owner !== input.owner || category.ownerId !== input.ownerId) {
      throw new BadRequestException('Category belongs to another owner');
    }

    if (category.type !== input.type) {
      throw new BadRequestException('Category type does not match the transaction type');
    }

    return { card };
  }

  // A card purchase takes the owner of its card and is always an expense (spec 029 FR 1-4).
  private async ensureCard(
    creditCardId: string,
    input: {
      accessibleOwners: OwnerAccess[];
      blockArchivedAccount: boolean;
      owner: OwnerType;
      ownerId: string;
      type: TransactionType;
    },
  ): Promise<CreditCardEntity> {
    const card = await this.creditCardRepository.findCreditCardById(creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException('Credit card not found');
    }

    if (input.type !== TransactionType.EXPENSE) {
      throw new BadRequestException('Credit card purchases must be expenses');
    }

    if (input.blockArchivedAccount && card.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Credit card is archived');
    }

    if (card.owner !== input.owner || card.ownerId !== input.ownerId) {
      throw new BadRequestException('Credit card belongs to another owner');
    }

    return card;
  }
}
