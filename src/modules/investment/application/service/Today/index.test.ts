import { today } from './index';

it('SHOULD return the UTC calendar day', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T23:30:00Z'));

  expect(today()).toBe('2026-11-09');

  jest.useRealTimers();
});
