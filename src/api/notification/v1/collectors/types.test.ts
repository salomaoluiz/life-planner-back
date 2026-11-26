import { stateOf } from './types';

it('SHOULD classify a date against the local date', () => {
  expect(stateOf('2026-11-22', '2026-11-23')).toBe('OVERDUE');
  expect(stateOf('2026-11-23', '2026-11-23')).toBe('DUE_TODAY');
  expect(stateOf('2026-11-24', '2026-11-23')).toBe('UPCOMING');
});
