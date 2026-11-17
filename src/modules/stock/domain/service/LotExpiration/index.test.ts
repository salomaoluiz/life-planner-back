import {
  addDays,
  daysBetween,
  effectiveExpiration,
  lotStatus,
  nearestExpiration,
  worstStatus,
} from './index';

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
const today = day('2026-11-10');
const rules = { openedShelfLifeDays: 5, warnDaysClosed: 7, warnDaysOpened: 1 };

describe('effectiveExpiration', () => {
  it('SHOULD be the printed date for a closed lot', () => {
    expect(effectiveExpiration({ expirationDate: day('2026-11-30') }, 5)).toEqual(
      day('2026-11-30'),
    );
  });

  it('SHOULD be the earlier of the printed date and opening + shelf life', () => {
    const lot = { expirationDate: day('2026-11-30'), openedAt: today };

    expect(effectiveExpiration(lot, 5)).toEqual(day('2026-11-15'));
    expect(effectiveExpiration({ ...lot, expirationDate: day('2026-11-12') }, 5)).toEqual(
      day('2026-11-12'),
    );
  });

  it('SHOULD use opening + shelf life WHEN there is no printed date, and the printed date WHEN the item has no shelf life', () => {
    expect(effectiveExpiration({ openedAt: today }, 5)).toEqual(day('2026-11-15'));
    expect(effectiveExpiration({ expirationDate: day('2026-11-30'), openedAt: today })).toEqual(
      day('2026-11-30'),
    );
    expect(effectiveExpiration({})).toBeUndefined();
  });
});

describe('lotStatus', () => {
  it.each([
    ['NONE', {}],
    ['EXPIRED', { expirationDate: day('2026-11-09') }],
    ['EXPIRING', { expirationDate: day('2026-11-17') }],
    ['OK', { expirationDate: day('2026-11-18') }],
  ])('SHOULD be %s for a closed lot', (expected, lot) => {
    expect(lotStatus(lot, rules, today)).toBe(expected);
  });

  it('SHOULD use warnDaysOpened for an open lot', () => {
    const open = { expirationDate: day('2026-12-30'), openedAt: day('2026-11-06') };

    expect(lotStatus(open, rules, today)).toBe('EXPIRING');
    expect(lotStatus({ ...open, openedAt: day('2026-11-10') }, rules, today)).toBe('OK');
  });
});

describe('worstStatus / nearestExpiration / date helpers', () => {
  it('SHOULD rank EXPIRED > EXPIRING > OK > NONE', () => {
    expect(worstStatus(['OK', 'EXPIRING', 'NONE'])).toBe('EXPIRING');
    expect(worstStatus(['OK', 'EXPIRED'])).toBe('EXPIRED');
    expect(worstStatus([])).toBe('NONE');
  });

  it('SHOULD pick the earliest effective expiration', () => {
    const lots = [{ expirationDate: day('2026-12-01') }, { expirationDate: day('2026-11-20') }, {}];

    expect(nearestExpiration(lots)).toEqual(day('2026-11-20'));
    expect(nearestExpiration([{}])).toBeUndefined();
  });

  it('SHOULD add and count days', () => {
    expect(addDays(today, 5)).toEqual(day('2026-11-15'));
    expect(daysBetween(today, day('2026-11-15'))).toBe(5);
  });
});
