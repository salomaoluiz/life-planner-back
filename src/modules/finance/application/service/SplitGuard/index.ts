import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { AccountStatus, SystemCategoryKey } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { SplitRuleError } from '@finance/domain/service/SplitRules';

// Runs a pure split rule and turns its error into the 422 whose message is the spec code (`details` for the mismatch).
export function applySplitRules<T>(rule: () => T): T {
  try {
    return rule();
  } catch (error) {
    if (error instanceof SplitRuleError) {
      throw new UnprocessableEntityException(
        error.details ? { details: error.details, message: error.code } : error.code,
      );
    }
    throw error;
  }
}

// The `systemKey` shorthand of a request part (`SPLIT_ADJUSTMENT`) resolves to the seeded category id.
export interface SplitSource {
  account?: AccountEntity;
  card?: CreditCardEntity;
  owner: OwnerAccess;
}

export function resolveCategoryId(part: { categoryId?: string; systemKey?: SystemCategoryKey }) {
  return part.categoryId ?? SYSTEM_CATEGORY_IDS[part.systemKey as SystemCategoryKey];
}

// FR: the source (account XOR card) must be readable (404), its owner writable (archived family 422) and active.
export async function loadWritableSource(
  repositories: {
    accountRepository: IFinanceAccountRepository;
    creditCardRepository: IFinanceCreditCardRepository;
  },
  input: {
    accessibleOwners: OwnerAccess[];
    accountId?: null | string;
    creditCardId?: null | string;
  },
): Promise<SplitSource> {
  if (((input.accountId ?? null) === null) === ((input.creditCardId ?? null) === null)) {
    throw new UnprocessableEntityException('Send either accountId or creditCardId');
  }

  if (input.accountId) {
    const account = await repositories.accountRepository.findAccountById(input.accountId);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException('Account not found');
    }
    ensureOwnerWritable(input.accessibleOwners, account);
    if (account.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Account is archived');
    }

    return { account, owner: { owner: account.owner, ownerId: account.ownerId } };
  }

  const card = await repositories.creditCardRepository.findCreditCardById(
    input.creditCardId as string,
  );

  if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
    throw new NotFoundException('Credit card not found');
  }
  ensureOwnerWritable(input.accessibleOwners, card);
  if (card.status === AccountStatus.ARCHIVED) {
    throw new UnprocessableEntityException('Credit card is archived');
  }

  return { card, owner: { owner: card.owner, ownerId: card.ownerId } };
}

export const SPLIT_SOURCE_NOT_ALLOWED = 'SPLIT_SOURCE_NOT_ALLOWED';

// FR 16: only an ordinary transaction may be split (no installment, projected, transfer, card credit, invoice payment,
// investment row or system row); a recurring occurrence converts alone.
export function assertConvertible(row: TransactionEntity): void {
  if (
    row.installmentPlanId !== null ||
    row.transferId !== null ||
    row.projected ||
    row.prepaymentId !== null ||
    row.refundedTransactionId !== null ||
    row.refundedPlanId !== null ||
    row.externalLock !== null ||
    row.splitId !== null ||
    row.category.systemKey !== null
  ) {
    throw new UnprocessableEntityException(SPLIT_SOURCE_NOT_ALLOWED);
  }
}
