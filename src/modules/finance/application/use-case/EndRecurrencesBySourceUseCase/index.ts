import { Inject } from '@nestjs/common';

import {
  EndRecurrencesBySourceInput,
  EndRecurrencesBySourceSchema,
} from '@finance/application/dto/EndRecurrencesBySource';
import { RecurrenceStatus } from '@finance/domain/enum';
import { IFinanceRecurrenceRepository } from '@finance/domain/repository';
import { occurrenceDate } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 034 FR 34: archiving an account or card ends its active series. The end date is the date of the last real
// occurrence; nothing is materialized or projected afterwards, and reactivating the source does not restart them.
export class EndRecurrencesBySourceUseCase implements UseCaseWithParams<
  EndRecurrencesBySourceInput,
  number
> {
  constructor(
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: EndRecurrencesBySourceInput): Promise<number> {
    const input = validate(EndRecurrencesBySourceSchema, params);
    const active = await this.recurrenceRepository.findByOwners(input.accessibleOwners, {
      accountId: input.accountId,
      creditCardId: input.creditCardId,
      status: RecurrenceStatus.ACTIVE,
    });

    for (const series of active) {
      await this.recurrenceRepository.applyChange({
        // Past the last generated row: no row is touched, only the series.
        fromNumber: series.firstNumber + series.lastGeneratedNumber,
        rowPatch: {},
        seriesPatch: {
          endDate:
            series.lastGeneratedNumber > 0
              ? occurrenceDate(series, series.lastGeneratedNumber)
              : undefined,
          nextOccurrenceDate: null,
          status: RecurrenceStatus.ENDED,
        },
        sourceId: series.id,
      });
    }

    return active.length;
  }
}
