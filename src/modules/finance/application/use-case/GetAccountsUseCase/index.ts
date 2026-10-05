import { Inject } from '@nestjs/common';

import { GetAccountsInput, GetAccountsSchema } from '@finance/application/dto/GetAccounts';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// ACTIVE first, then name ascending, case-insensitive.
function compareAccounts(a: AccountEntity, b: AccountEntity): number {
  const statusRank = (account: AccountEntity) => (account.status === AccountStatus.ACTIVE ? 0 : 1);

  return statusRank(a) - statusRank(b) || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

export class GetAccountsUseCase implements UseCaseWithParams<GetAccountsInput, AccountEntity[]> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: GetAccountsInput): Promise<AccountEntity[]> {
    const input = validate(GetAccountsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const accounts = await this.accountRepository.findAccounts(owners);

    return [...accounts].sort(compareAccounts);
  }
}
