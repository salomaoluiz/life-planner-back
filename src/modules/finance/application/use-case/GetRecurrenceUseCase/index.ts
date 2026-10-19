import { Inject, NotFoundException } from '@nestjs/common';

import { GetRecurrenceInput, GetRecurrenceSchema } from '@finance/application/dto/GetRecurrences';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { RecurrenceStatus } from '@finance/domain/enum';
import { IFinanceRecurrenceRepository } from '@finance/domain/repository';
import {
  addDays,
  lastDayOfMonth,
  upcomingOccurrences,
} from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const UPCOMING_LIMIT = 12;

export interface RecurrenceDetails {
  occurrences: TransactionEntity[];
  projected: ProjectedOccurrence[];
  recurrence: RecurrenceEntity;
}

export class GetRecurrenceUseCase implements UseCaseWithParams<
  GetRecurrenceInput,
  RecurrenceDetails
> {
  constructor(
    @Inject(GetProjectionsUseCase)
    private readonly getProjectionsUseCase: GetProjectionsUseCase,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: GetRecurrenceInput): Promise<RecurrenceDetails> {
    const input = validate(GetRecurrenceSchema, params);
    const recurrence = await this.recurrenceRepository.findById(input.id);

    if (!recurrence || !hasOwnerAccess(input.accessibleOwners, recurrence)) {
      throw new NotFoundException();
    }

    const occurrences = await this.recurrenceRepository.findOccurrences(recurrence.id);

    if (recurrence.status !== RecurrenceStatus.ACTIVE) {
      return { occurrences, projected: [], recurrence };
    }

    const horizon = lastDayOfMonth(input.today);
    const real = new Set(occurrences.map((row) => row.occurrenceNumber));
    const scheduled = upcomingOccurrences(
      recurrence,
      addDays(horizon, 1),
      UPCOMING_LIMIT + recurrence.skippedNumbers.length + occurrences.length,
    )
      .filter((item) => {
        const number = recurrence.firstNumber - 1 + item.k;

        return !recurrence.skippedNumbers.includes(number) && !real.has(number);
      })
      .slice(0, UPCOMING_LIMIT);

    return {
      occurrences,
      projected: await this.getProjectionsUseCase.project(recurrence, scheduled, input.today),
      recurrence,
    };
  }
}
