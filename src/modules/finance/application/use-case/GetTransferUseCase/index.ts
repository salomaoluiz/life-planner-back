import { Inject, NotFoundException } from '@nestjs/common';

import { TransferAccessInput, TransferAccessSchema } from '@finance/application/dto/TransferAccess';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import { IFinanceAccountRepository, IFinanceTransferRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 098 section 7: 404 unless the caller can read BOTH sides (a one-side reader sees the row in the list only).
export class GetTransferUseCase implements UseCaseWithParams<TransferAccessInput, TransferEntity> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceTransferRepository')
    private readonly transferRepository: IFinanceTransferRepository,
  ) {}

  async execute(params: TransferAccessInput): Promise<TransferEntity> {
    const input = validate(TransferAccessSchema, params);
    const transfer = await this.transferRepository.findTransferById(input.id);

    if (!transfer?.fromAccountId || !transfer.toAccountId) {
      throw new NotFoundException('Transfer not found');
    }
    const accounts = await this.accountRepository.findAccountsByIds([
      transfer.fromAccountId,
      transfer.toAccountId,
    ]);

    if (
      accounts.length !== 2 ||
      !accounts.every((account: AccountEntity) => hasOwnerAccess(input.accessibleOwners, account))
    ) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }
}
