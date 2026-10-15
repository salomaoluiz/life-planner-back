import { Inject } from '@nestjs/common';

import { GetAccountsInput, GetAccountsSchema } from '@finance/application/dto/GetAccounts';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { AccountWithBalances } from '@finance/domain/service/AccountBalance';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// ACTIVE first, then name ascending, case-insensitive.
export class GetAccountsUseCase implements UseCaseWithParams<
  GetAccountsInput,
  AccountWithBalances[]
> {
  constructor(
    @Inject(AttachAccountBalancesUseCase)
    private readonly attachAccountBalancesUseCase: AttachAccountBalancesUseCase,
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: GetAccountsInput): Promise<AccountWithBalances[]> {
    const input = validate(GetAccountsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const accounts = await this.accountRepository.findAccounts(owners);

    const withBalances = await this.attachAccountBalancesUseCase.execute({
      accounts,
      today: input.today,
    });

    return [...withBalances].sort(compareAccounts);
  }
}

function compareAccounts(a: AccountWithBalances, b: AccountWithBalances): number {
  return (
    statusRank(a.account) - statusRank(b.account) ||
    a.account.name.toLowerCase().localeCompare(b.account.name.toLowerCase())
  );
}
function statusRank(account: AccountEntity): number {
  return account.status === AccountStatus.ACTIVE ? 0 : 1;
}
