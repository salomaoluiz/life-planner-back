import { Inject, NotFoundException } from '@nestjs/common';

import { UpdateAccountInput, UpdateAccountSchema } from '@finance/application/dto/UpdateAccount';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateAccountUseCase implements UseCaseWithParams<UpdateAccountInput, AccountEntity> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: UpdateAccountInput): Promise<AccountEntity> {
    const input = validate(UpdateAccountSchema, params);

    const account = await this.accountRepository.findAccountById(input.id);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException();
    }

    return this.accountRepository.updateAccount({
      balance: input.balance,
      icon: input.icon,
      id: input.id,
      name: input.name,
      status: input.status,
    });
  }
}
