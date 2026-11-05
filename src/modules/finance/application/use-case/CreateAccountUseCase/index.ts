import { ForbiddenException, Inject, UnprocessableEntityException } from '@nestjs/common';

import { CreateAccountInput, CreateAccountSchema } from '@finance/application/dto/CreateAccount';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import {
  IFinanceAccountFavoriteRepository,
  IFinanceAccountRepository,
} from '@finance/domain/repository';
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
    @Inject('IFinanceAccountFavoriteRepository')
    private readonly favoriteRepository: IFinanceAccountFavoriteRepository,
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: CreateAccountInput): Promise<AccountWithBalances> {
    const input = validate(CreateAccountSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId });

    // Spec 094 FR 4: an archived account can't be the favorite.
    if (input.isFavorite && input.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException("An archived account can't be the favorite");
    }

    const account = await this.accountRepository.createAccount({
      currency: input.currency,
      icon: input.icon,
      initialBalance: input.initialBalance,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      status: input.status,
    });
    if (input.isFavorite && input.userId !== undefined) {
      await this.favoriteRepository.set(input.userId, account.id);
    }

    const [created] = await this.attachAccountBalancesUseCase.execute({
      accounts: [account],
      today: input.today,
    });

    return created;
  }
}
