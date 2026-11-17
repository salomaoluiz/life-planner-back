import { RecurrenceUnit } from '@finance/domain/enum';
import { RecurrenceFrequency } from '@finance/domain/service/RecurrenceInterval';

// Spec 114: the two stored columns of a series rule as the domain value.
export function toFrequency(row: {
  frequency_interval: number;
  frequency_unit: keyof typeof RecurrenceUnit;
}): RecurrenceFrequency {
  return { interval: row.frequency_interval, unit: RecurrenceUnit[row.frequency_unit] };
}
