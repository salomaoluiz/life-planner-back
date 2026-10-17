import { Inject } from '@nestjs/common';

import {
  AttachAccountBalancesInput,
  AttachAccountBalancesSchema,
} from '@finance/application/dto/AttachAccountBalances';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { AccountWithBalances, withBalances } from '@finance/domain/service/AccountBalance';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Current and end-of-month balances of the given accounts: ONE grouped query over the unpaid rows
// due up to the end of the month, never the history (the stored ledger already holds the paid ones).
export class AttachAccountBalancesUseCase implements UseCaseWithParams<
  AttachAccountBalancesInput,
  AccountWithBalances[]
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: AttachAccountBalancesInput): Promise<AccountWithBalances[]> {
    const input = validate(AttachAccountBalancesSchema, params);

    if (input.accounts.length === 0) {
      return [];
    }

    const unpaid = await this.accountRepository.findUnpaidSums({
      accountIds: input.accounts.map((account) => account.id),
      today: input.today,
    });
    const sumsByAccount = new Map(unpaid.map((sums) => [sums.accountId, sums]));

    return input.accounts.map((account) => withBalances(account, sumsByAccount.get(account.id)));
  }
}
