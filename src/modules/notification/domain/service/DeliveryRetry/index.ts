// Spec 124 section 5 / FR 25, 27, 28: retention and retry limits in one place.
export const NOTICE_RETENTION_DAYS = 30;
export const DEVICE_STALE_DAYS = 60;
export const DELIVERY_RETENTION_DAYS = 7;
export const EXPO_BATCH_SIZE = 100;
export const WEB_PARALLEL = 20;
export const DELIVERY_BATCH_LIMIT = 1000;
export const RECEIPT_MIN_AGE_MINUTES = 15;
export const RECEIPT_MAX_AGE_HOURS = 24;
export const RECEIPT_BATCH_LIMIT = 1000;
export const TEST_PUSH_LIMIT = 5;
export const TEST_PUSH_WINDOW_MS = 3_600_000;
export const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

// 429/5xx/network: wait 1, 5, 15 minutes; the 4th failed attempt ends as FAILED.
const RETRY_DELAYS_MINUTES = [1, 5, 15];
export const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;

export type RetryOutcome =
  | { attempts: number; nextAttemptAt: Date; status: 'PENDING' }
  | { attempts: number; status: 'FAILED' };

export function afterFailure(attempts: number, now: Date): RetryOutcome {
  const failed = attempts + 1;

  if (failed >= MAX_ATTEMPTS) {
    return { attempts: failed, status: 'FAILED' };
  }

  return {
    attempts: failed,
    nextAttemptAt: new Date(now.getTime() + RETRY_DELAYS_MINUTES[failed - 1] * 60_000),
    status: 'PENDING',
  };
}
