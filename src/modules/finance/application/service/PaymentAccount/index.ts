import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceAccountRepository } from '@finance/domain/repository';

// Spec 035 FR 19: the account must exist, be readable by the caller (any owner combination) and be active.
export async function assertPaymentAccount(
  accountRepository: IFinanceAccountRepository,
  accessibleOwners: OwnerAccess[],
  accountId: string,
): Promise<void> {
  const [account] = await accountRepository.findAccountsByIds([accountId]);

  if (!account || !hasOwnerAccess(accessibleOwners, account)) {
    throw new NotFoundException('Account not found');
  }
  if (account.status === AccountStatus.ARCHIVED) {
    throw new UnprocessableEntityException('Account is archived');
  }
}
