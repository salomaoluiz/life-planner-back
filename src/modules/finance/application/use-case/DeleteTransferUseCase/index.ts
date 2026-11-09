import { Inject } from '@nestjs/common';

import { TransferAccessInput, TransferAccessSchema } from '@finance/application/dto/TransferAccess';
import { loadWritableSides } from '@finance/application/service/TransferSides';
import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import { IFinanceAccountRepository, IFinanceTransferRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Removes the transfer with its out, in and fee rows (spec 098 FR 7); needs write access to both owners.
export class DeleteTransferUseCase implements UseCaseWithParams<TransferAccessInput, void> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(GetTransferUseCase)
    private readonly getTransferUseCase: GetTransferUseCase,
    @Inject('IFinanceTransferRepository')
    private readonly transferRepository: IFinanceTransferRepository,
  ) {}

  async execute(params: TransferAccessInput): Promise<void> {
    const input = validate(TransferAccessSchema, params);
    const transfer = await this.getTransferUseCase.execute(input);

    await loadWritableSides(this.accountRepository, {
      accessibleOwners: input.accessibleOwners,
      allowArchived: true,
      fromAccountId: transfer.fromAccountId as string,
      toAccountId: transfer.toAccountId as string,
    });
    await this.transferRepository.deleteTransfer(input.id);
  }
}
