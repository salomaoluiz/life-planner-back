import { Inject, NotFoundException } from '@nestjs/common';

import {
  DeleteOccurrenceInput,
  DeleteOccurrenceSchema,
} from '@finance/application/dto/DeleteRecurrence';
import { DeleteRecurrenceUseCase } from '@finance/application/use-case/DeleteRecurrenceUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { InstallmentEditScope, RecurrenceStatus } from '@finance/domain/enum';
import { IFinanceRecurrenceRepository } from '@finance/domain/repository';
import { occurrenceDate } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 034 FR 29-30 for an occurrence that may be real or still projected.
export class DeleteOccurrenceUseCase implements UseCaseWithParams<DeleteOccurrenceInput, void> {
  constructor(
    @Inject(DeleteRecurrenceUseCase)
    private readonly deleteRecurrenceUseCase: DeleteRecurrenceUseCase,
    @Inject(DeleteTransactionUseCase)
    private readonly deleteTransactionUseCase: DeleteTransactionUseCase,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: DeleteOccurrenceInput): Promise<void> {
    const input = validate(DeleteOccurrenceSchema, params);
    const series = await this.recurrenceRepository.findById(input.recurrenceId);

    if (!series || !hasOwnerAccess(input.accessibleOwners, series)) {
      throw new NotFoundException();
    }

    const k = input.occurrenceNumber - series.firstNumber + 1;
    const date = k >= 1 ? occurrenceDate(series, k) : undefined;

    if (date === undefined || (series.endDate && date > series.endDate)) {
      throw new NotFoundException('Occurrence not found');
    }

    if (input.scope === InstallmentEditScope.THIS_AND_NEXT) {
      return this.deleteFrom(input, series, k);
    }

    return this.deleteOne(input, series, k);
  }

  // The first occurrence and everything after it is the whole series.
  private async deleteFrom(
    input: DeleteOccurrenceInput,
    series: RecurrenceEntity,
    k: number,
  ): Promise<void> {
    if (k === 1) {
      await this.deleteRecurrenceUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        confirmPaid: input.confirmPaid,
        id: series.id,
      });

      return;
    }

    await this.recurrenceRepository.removeFrom({
      confirmPaid: input.confirmPaid ?? false,
      deleteSeries: false,
      detachLocked: false,
      fromNumber: input.occurrenceNumber,
      id: series.id,
      seriesPatch: {
        endDate: occurrenceDate(series, k - 1),
        lastGeneratedNumber: Math.min(series.lastGeneratedNumber, k - 1),
        nextOccurrenceDate: null,
        skippedNumbers: series.skippedNumbers.filter((number) => number < input.occurrenceNumber),
        status: RecurrenceStatus.ENDED,
      },
    });
  }

  private async deleteOne(
    input: DeleteOccurrenceInput,
    series: RecurrenceEntity,
    k: number,
  ): Promise<void> {
    if (series.skippedNumbers.includes(input.occurrenceNumber)) {
      throw new NotFoundException('Occurrence was deleted');
    }

    const rows = await this.recurrenceRepository.findOccurrences(series.id);
    const real = rows.find((row) => row.occurrenceNumber === input.occurrenceNumber);

    if (real) {
      await this.deleteTransactionUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        id: real.id,
        scope: InstallmentEditScope.ONLY_THIS,
      });

      return;
    }
    if (k <= series.lastGeneratedNumber) {
      throw new NotFoundException('Occurrence was deleted');
    }

    await this.recurrenceRepository.skipNumber(series.id, input.occurrenceNumber);
  }
}
