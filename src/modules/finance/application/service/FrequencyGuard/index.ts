import { UnprocessableEntityException } from '@nestjs/common';

import {
  isIntervalAllowed,
  RECURRENCE_INTERVAL_LIMITS,
  RecurrenceFrequency,
} from '@finance/domain/service/RecurrenceInterval';

// Spec 114 FR 2: 422 naming the range of the unit when the interval does not fit it.
export function assertFrequencyAllowed(frequency: RecurrenceFrequency): void {
  if (!isIntervalAllowed(frequency.unit, frequency.interval)) {
    throw new UnprocessableEntityException(
      `Interval must be between 1 and ${RECURRENCE_INTERVAL_LIMITS[frequency.unit]} for ${frequency.unit}`,
    );
  }
}
