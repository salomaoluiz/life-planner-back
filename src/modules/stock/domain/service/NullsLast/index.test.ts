import { compareNullsLast } from './index';

it('SHOULD order numbers ascending with missing values last', () => {
  expect([3, undefined, 1, 2, undefined].sort(compareNullsLast)).toEqual([
    1,
    2,
    3,
    undefined,
    undefined,
  ]);
  expect(compareNullsLast(undefined, undefined)).toBe(0);
  expect(compareNullsLast(1, undefined)).toBeLessThan(0);
  expect(compareNullsLast(undefined, 1)).toBeGreaterThan(0);
});
