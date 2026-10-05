import { Inject, NotFoundException } from '@nestjs/common';

import { DeleteAccountInput, DeleteAccountSchema } from '@finance/application/dto/DeleteAccount';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class DeleteAccountUseCase implements UseCaseWithParams<DeleteAccountInput, void> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
  ) {}

  async execute(params: DeleteAccountInput): Promise<void> {
    const input = validate(DeleteAccountSchema, params);

    const account = await this.accountRepository.findAccountById(input.id);

    if (!account || !hasOwnerAccess(input.accessibleOwners, account)) {
      throw new NotFoundException();
    }

    await this.accountRepository.deleteAccount(input.id);
  }
}
