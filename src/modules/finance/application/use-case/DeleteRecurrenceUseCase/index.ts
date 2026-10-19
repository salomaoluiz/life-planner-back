import { Inject, NotFoundException } from '@nestjs/common';

import {
  DeleteRecurrenceInput,
  DeleteRecurrenceSchema,
} from '@finance/application/dto/DeleteRecurrence';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceRecurrenceRepository, RemoveRecurrenceResult } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 034 scope ALL (FR 31): the series and every real row go; paid account rows need `confirmPaid` (409 with the
// counts otherwise); card rows in a paid invoice and refunded rows stay as plain purchases.
export class DeleteRecurrenceUseCase implements UseCaseWithParams<
  DeleteRecurrenceInput,
  RemoveRecurrenceResult
> {
  constructor(
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: DeleteRecurrenceInput): Promise<RemoveRecurrenceResult> {
    const input = validate(DeleteRecurrenceSchema, params);
    const series = await this.recurrenceRepository.findById(input.id);

    if (!series || !hasOwnerAccess(input.accessibleOwners, series)) {
      throw new NotFoundException();
    }

    return this.recurrenceRepository.removeFrom({
      confirmPaid: input.confirmPaid ?? false,
      deleteSeries: true,
      detachLocked: true,
      fromNumber: 0,
      id: series.id,
    });
  }
}
