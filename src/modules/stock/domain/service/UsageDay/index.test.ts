import { usageDay } from './index';

it('SHOULD use the calendar day of the time zone, not of UTC', () => {
  const instant = new Date('2026-11-24T01:30:00.000Z');

  expect(usageDay(instant, 'America/Sao_Paulo')).toBe('2026-11-23');
  expect(usageDay(instant, 'UTC')).toBe('2026-11-24');
});
