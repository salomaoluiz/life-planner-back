import { afterFailure } from './index';

const now = new Date('2026-11-23T11:00:00.000Z');

it('SHOULD retry after 1, 5 and 15 minutes AND fail on the 4th attempt', () => {
  expect(afterFailure(0, now)).toEqual({
    attempts: 1,
    nextAttemptAt: new Date('2026-11-23T11:01:00.000Z'),
    status: 'PENDING',
  });
  expect(afterFailure(1, now)).toEqual({
    attempts: 2,
    nextAttemptAt: new Date('2026-11-23T11:05:00.000Z'),
    status: 'PENDING',
  });
  expect(afterFailure(2, now)).toEqual({
    attempts: 3,
    nextAttemptAt: new Date('2026-11-23T11:15:00.000Z'),
    status: 'PENDING',
  });
  expect(afterFailure(3, now)).toEqual({ attempts: 4, status: 'FAILED' });
});
