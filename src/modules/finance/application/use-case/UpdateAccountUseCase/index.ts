import { Inject, NotFoundException } from '@nestjs/common';

import { UpdateAccountInput, UpdateAccountSchema } from '@finance/application/dto/UpdateAccount';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { AccountWithBalances } from '@finance/domain/service/AccountBalance';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateAccountUseCase implements UseCaseWithParams<
  UpdateAccountInput,
  AccountWithBalances
> {
  constructor(
    @Inject(AttachAccountBalancesUseCase)
    private readonly attachAccountBalancesUseCase: AttachAccountBalancesUseCase,
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: UpdateAccountInput): Promise<AccountWithBalances> {
    const input = validate(UpdateAccountSchema, params);

    const account = await this.accountRepository.findAccountById(input.id);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException();
    }

    const updated = await this.accountRepository.updateAccount({
      icon: input.icon,
      id: input.id,
      name: input.name,
      status: input.status,
    });
    const [result] = await this.attachAccountBalancesUseCase.execute({
      accounts: [updated],
      today: input.today,
    });

    return result;
  }
}
