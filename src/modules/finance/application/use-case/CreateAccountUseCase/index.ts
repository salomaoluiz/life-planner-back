import { ForbiddenException, Inject } from '@nestjs/common';

import { CreateAccountInput, CreateAccountSchema } from '@finance/application/dto/CreateAccount';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateAccountUseCase implements UseCaseWithParams<CreateAccountInput, AccountEntity> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: CreateAccountInput): Promise<AccountEntity> {
    const input = validate(CreateAccountSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    return this.accountRepository.createAccount({
      balance: input.balance,
      icon: input.icon,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      status: input.status,
    });
  }
}
