import { todayInSaoPaulo } from './credit-card-today';

describe('todayInSaoPaulo', () => {
  it('SHOULD return the São Paulo calendar day, not the UTC one (02:30Z is still the previous evening)', () => {
    expect(todayInSaoPaulo(new Date('2026-10-15T02:30:00.000Z'))).toBe('2026-10-14');
  });

  it('SHOULD return the same day WHEN UTC and São Paulo agree', () => {
    expect(todayInSaoPaulo(new Date('2026-10-15T15:00:00.000Z'))).toBe('2026-10-15');
  });

  it('SHOULD default to the current time', () => {
    expect(todayInSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
