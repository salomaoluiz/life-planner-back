import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { IFinanceAccountRepository } from '@finance/domain/repository';

// Spec 040 FR 7: money moves between an account and a card only in one currency.
export const ACCOUNT_CARD_CURRENCY_MISMATCH =
  'Account currency must match the credit card currency';

// Spec 035 FR 19: the account must exist, be readable by the caller (any owner combination) and be active.
export async function assertPaymentAccount(
  accountRepository: IFinanceAccountRepository,
  accessibleOwners: OwnerAccess[],
  accountId: string,
  cardCurrency: CurrencyCode,
): Promise<void> {
  const [account] = await accountRepository.findAccountsByIds([accountId]);

  if (!account || !hasOwnerAccess(accessibleOwners, account)) {
    throw new NotFoundException('Account not found');
  }
  if (account.status === AccountStatus.ARCHIVED) {
    throw new UnprocessableEntityException('Account is archived');
  }
  if (account.currency !== cardCurrency) {
    throw new UnprocessableEntityException(ACCOUNT_CARD_CURRENCY_MISMATCH);
  }
}
