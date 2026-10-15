import { ForbiddenException, Inject } from '@nestjs/common';

import { CreateAccountInput, CreateAccountSchema } from '@finance/application/dto/CreateAccount';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { AccountWithBalances } from '@finance/domain/service/AccountBalance';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateAccountUseCase implements UseCaseWithParams<
  CreateAccountInput,
  AccountWithBalances
> {
  constructor(
    @Inject(AttachAccountBalancesUseCase)
    private readonly attachAccountBalancesUseCase: AttachAccountBalancesUseCase,
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: CreateAccountInput): Promise<AccountWithBalances> {
    const input = validate(CreateAccountSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    const account = await this.accountRepository.createAccount({
      icon: input.icon,
      initialBalance: input.initialBalance,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      status: input.status,
    });
    const [created] = await this.attachAccountBalancesUseCase.execute({
      accounts: [account],
      today: input.today,
    });

    return created;
  }
}
