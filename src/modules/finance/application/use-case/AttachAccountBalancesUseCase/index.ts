import { Inject } from '@nestjs/common';

import {
  AttachAccountBalancesInput,
  AttachAccountBalancesSchema,
} from '@finance/application/dto/AttachAccountBalances';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { AccountWithBalances, withBalances } from '@finance/domain/service/AccountBalance';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Current and end-of-month balances of the given accounts: ONE grouped query over the future-dated
// rows, never the history (the stored ledger already holds everything else).
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

    const future = await this.accountRepository.findFutureSums({
      accountIds: input.accounts.map((account) => account.id),
      today: input.today,
    });
    const sumsByAccount = new Map(future.map((sums) => [sums.accountId, sums]));

    return input.accounts.map((account) => withBalances(account, sumsByAccount.get(account.id)));
  }
}
