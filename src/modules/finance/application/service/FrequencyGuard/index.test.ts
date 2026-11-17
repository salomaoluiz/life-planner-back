import { UnprocessableEntityException } from '@nestjs/common';

import { RecurrenceUnit } from '@finance/domain/enum';

import { assertFrequencyAllowed } from './index';

describe('assertFrequencyAllowed', () => {
  it('accepts an interval inside the range of its unit', () => {
    expect(() =>
      assertFrequencyAllowed({ interval: 24, unit: RecurrenceUnit.MONTH }),
    ).not.toThrow();
  });

  it.each([
    [RecurrenceUnit.DAY, 366],
    [RecurrenceUnit.WEEK, 53],
    [RecurrenceUnit.MONTH, 25],
    [RecurrenceUnit.YEAR, 11],
  ])('refuses %s %i with 422 naming the range', (unit, interval) => {
    expect.assertions(2);

    try {
      assertFrequencyAllowed({ interval, unit });
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).message).toMatch(
        new RegExp(`^Interval must be between 1 and \\d+ for ${unit}$`),
      );
    }
  });
});
