import { Inject, UnprocessableEntityException } from '@nestjs/common';

import { TransferAccessInput, TransferAccessSchema } from '@finance/application/dto/TransferAccess';
import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import { loadWritableSides } from '@finance/application/service/TransferSides';
import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import { InstallmentEditScope } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceRecurrenceRepository,
  IFinanceTransferRepository,
} from '@finance/domain/repository';
import { occurrenceDate } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Removes the transfer with its out, in and fee rows (spec 098 FR 7); needs write access to both owners.
export class DeleteTransferUseCase implements UseCaseWithParams<TransferAccessInput, void> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(GetTransferUseCase)
    private readonly getTransferUseCase: GetTransferUseCase,
    @Inject(MaterializationGate)
    private readonly materializationGate: MaterializationGate,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
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

    if (transfer.recurrenceId === null) {
      await this.transferRepository.deleteTransfer(input.id);

      return;
    }

    // Spec 034 FR 29: an occurrence of a series asks the scope.
    if (input.scope === undefined) {
      throw new UnprocessableEntityException('Choose the delete scope');
    }
    if (input.scope === InstallmentEditScope.ONLY_THIS) {
      await this.transferRepository.deleteTransfer(input.id);

      return;
    }

    await this.deleteFrom(transfer.recurrenceId, transfer.occurrenceNumber as number);
  }

  // THIS_AND_NEXT: this occurrence and every later one go away; the series ends at the previous occurrence.
  private async deleteFrom(recurrenceId: string, fromNumber: number): Promise<void> {
    const series = await this.recurrenceRepository.findById(recurrenceId);

    await this.transferRepository.deleteTransferSeriesFrom({
      deleteSeries: fromNumber === 1,
      endDate: fromNumber > 1 && series ? occurrenceDate(series, fromNumber - 1) : null,
      fromNumber,
      lastGeneratedNumber: fromNumber - 1,
      recurrenceId,
    });

    if (series) {
      this.materializationGate.invalidate([series.ownerId]);
    }
  }
}
