import { isInsideQuietHours } from '@notification/domain/service/NotificationClock';

// Spec 124 FR 13: the summary is never delayed by quiet hours, so it cannot be set inside them.
export function isSummaryInsideQuiet(
  summaryMinute: number,
  quietStartMinute: number,
  quietEndMinute: number,
): boolean {
  return isInsideQuietHours(summaryMinute, quietStartMinute, quietEndMinute);
}

// The picker steps follow the tick interval (FR 8): the summary minute must be a multiple of it.
export function isMultipleOfTick(minute: number, tickMinutes: number): boolean {
  return minute % tickMinutes === 0;
}
