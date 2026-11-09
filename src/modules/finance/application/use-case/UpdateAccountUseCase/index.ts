import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { UpdateAccountInput, UpdateAccountSchema } from '@finance/application/dto/UpdateAccount';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { EndRecurrencesBySourceUseCase } from '@finance/application/use-case/EndRecurrencesBySourceUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import {
  IFinanceAccountFavoriteRepository,
  IFinanceAccountRepository,
} from '@finance/domain/repository';
import { AccountWithBalances } from '@finance/domain/service/AccountBalance';
import { archivedAtFor } from '@finance/domain/service/ArchiveDay';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateAccountUseCase implements UseCaseWithParams<
  UpdateAccountInput,
  AccountWithBalances
> {
  constructor(
    @Inject(AttachAccountBalancesUseCase)
    private readonly attachAccountBalancesUseCase: AttachAccountBalancesUseCase,
    @Inject('IFinanceAccountFavoriteRepository')
    private readonly favoriteRepository: IFinanceAccountFavoriteRepository,
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(EndRecurrencesBySourceUseCase)
    private readonly endRecurrencesBySourceUseCase: EndRecurrencesBySourceUseCase,
  ) {}

  async execute(params: UpdateAccountInput): Promise<AccountWithBalances> {
    const input = validate(UpdateAccountSchema, params);

    const account = await this.accountRepository.findAccountById(input.id);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException();
    }

    const archiving =
      input.status === AccountStatus.ARCHIVED && account.status !== AccountStatus.ARCHIVED;

    // Spec 094 FR 4: an archived account can't be the favorite, neither already nor by this very request.
    if (input.isFavorite && (input.status ?? account.status) === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException("An archived account can't be the favorite");
    }

    const changesAccount =
      input.icon !== undefined ||
      input.name !== undefined ||
      input.status !== undefined ||
      input.type !== undefined;
    // Spec 042 FR 9 / spec 101: an account write on an archived family is refused (422); the favorite is a user preference.
    if (changesAccount) {
      ensureOwnerWritable(input.accessibleOwners, account);
    }
    const updated = changesAccount
      ? await this.accountRepository.updateAccount({
          archivedAt: archivedAtFor(account.status, input.status, new Date()),
          clearFavorites: archiving,
          icon: input.icon,
          id: input.id,
          name: input.name,
          status: input.status,
          type: input.type,
        })
      : account;

    if (input.userId !== undefined && input.isFavorite === true) {
      await this.favoriteRepository.set(input.userId, account.id);
    } else if (input.userId !== undefined && input.isFavorite === false) {
      await this.favoriteRepository.clear(input.userId, account.id);
    }
    // Archiving ends its recurring series (spec 034 FR 34); reactivating does not restart them.
    if (archiving) {
      await this.endRecurrencesBySourceUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        accountId: account.id,
      });
    }

    const [result] = await this.attachAccountBalancesUseCase.execute({
      accounts: [updated],
      today: input.today,
    });

    return result;
  }
}
