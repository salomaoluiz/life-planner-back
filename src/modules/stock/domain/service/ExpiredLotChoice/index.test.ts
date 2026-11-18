import { planConsumeWithChoice } from './index';

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

const today = day('2026-11-18');
const rules = { warnDaysClosed: 7, warnDaysOpened: 1 };
const expired = { expirationDate: day('2026-11-10'), id: 'old', quantity: 2 };
const valid = { expirationDate: day('2026-12-20'), id: 'new', quantity: 3 };

describe('planConsumeWithChoice', () => {
  it('SHOULD skip expired lots WHEN VALID_ONLY', () => {
    expect(planConsumeWithChoice([expired, valid], 2, 'VALID_ONLY', rules, today)).toEqual({
      consumes: [{ lotId: 'new', quantity: 2 }],
      discards: [],
    });
  });

  it('SHOULD return undefined WHEN VALID_ONLY and only expired lots hold stock', () => {
    expect(planConsumeWithChoice([expired], 1, 'VALID_ONLY', rules, today)).toBeUndefined();
  });

  it('SHOULD discard whole expired lots and consume the valid ones WHEN DISCARD_THEN_VALID', () => {
    expect(planConsumeWithChoice([expired, valid], 2, 'DISCARD_THEN_VALID', rules, today)).toEqual({
      consumes: [{ lotId: 'new', quantity: 2 }],
      discards: [{ lotId: 'old', quantity: 2 }],
    });
  });

  it('SHOULD only discard WHEN DISCARD_THEN_VALID and no valid lot has stock', () => {
    expect(planConsumeWithChoice([expired], 2, 'DISCARD_THEN_VALID', rules, today)).toEqual({
      consumes: [],
      discards: [{ lotId: 'old', quantity: 2 }],
    });
  });

  it('SHOULD return undefined WHEN the valid lots cannot hold the quantity', () => {
    expect(
      planConsumeWithChoice([expired, valid], 4, 'DISCARD_THEN_VALID', rules, today),
    ).toBeUndefined();
  });

  it('SHOULD consume the expired lots first WHEN EXPIRED_FIRST', () => {
    expect(planConsumeWithChoice([valid, expired], 3, 'EXPIRED_FIRST', rules, today)).toEqual({
      consumes: [
        { lotId: 'old', quantity: 2 },
        { lotId: 'new', quantity: 1 },
      ],
      discards: [],
    });
  });
});
