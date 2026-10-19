import { Inject } from '@nestjs/common';

import {
  GetAccountsByIdsInput,
  GetAccountsByIdsSchema,
} from '@finance/application/dto/GetAccountsByIds';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Only the accounts the caller can read: used to fill `paymentAccount` on card payloads (spec 035 FR 23).
export class GetAccountsByIdsUseCase implements UseCaseWithParams<
  GetAccountsByIdsInput,
  AccountEntity[]
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: GetAccountsByIdsInput): Promise<AccountEntity[]> {
    const input = validate(GetAccountsByIdsSchema, params);
    const ids = [...new Set(input.ids)];

    if (ids.length === 0) {
      return [];
    }

    const accounts = await this.accountRepository.findAccountsByIds(ids);

    return accounts.filter((account) => hasOwnerAccess(input.accessibleOwners, account));
  }
}
