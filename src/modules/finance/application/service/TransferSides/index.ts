import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceAccountRepository, TransferSide } from '@finance/domain/repository';
import { TransferRuleError } from '@finance/domain/service/TransferRules';

export const TRANSFER_ACCOUNT_ARCHIVED = 'TRANSFER_ACCOUNT_ARCHIVED';

// Runs a pure transfer rule and turns its error into the 422 whose message is the spec code.
export function applyTransferRules<T>(rule: () => T): T {
  try {
    return rule();
  } catch (error) {
    if (error instanceof TransferRuleError) {
      throw new UnprocessableEntityException(error.code);
    }
    throw error;
  }
}

function toSide(account: AccountEntity): TransferSide {
  return {
    accountId: account.id,
    currency: account.currency,
    owner: account.owner,
    ownerId: account.ownerId,
  };
}

export interface LoadedSides {
  from: AccountEntity;
  to: AccountEntity;
}

// Spec 098 section 4: both accounts must exist and be reachable (404), their owners writable (archived family 422)
// and, when asked, active (422 TRANSFER_ACCOUNT_ARCHIVED).
export async function loadWritableSides(
  accountRepository: IFinanceAccountRepository,
  params: {
    accessibleOwners: OwnerAccess[];
    allowArchived?: boolean;
    fromAccountId: string;
    toAccountId: string;
  },
): Promise<LoadedSides> {
  const accounts = await accountRepository.findAccountsByIds([params.fromAccountId, params.toAccountId]);
  const from = accounts.find((account) => account.id === params.fromAccountId);
  const to = accounts.find((account) => account.id === params.toAccountId);

  for (const account of [from, to]) {
    if (!account || !hasOwnerAccess(params.accessibleOwners, account)) {
      throw new NotFoundException('Account not found');
    }
  }
  for (const account of [from, to] as AccountEntity[]) {
    ensureOwnerWritable(params.accessibleOwners, account);
    if (params.allowArchived !== true && account.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException(TRANSFER_ACCOUNT_ARCHIVED);
    }
  }

  return { from: from as AccountEntity, to: to as AccountEntity };
}

export function sidesToRepository(sides: LoadedSides): { from: TransferSide; to: TransferSide } {
  return { from: toSide(sides.from), to: toSide(sides.to) };
}
