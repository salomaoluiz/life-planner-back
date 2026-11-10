import { today } from './index';

it('SHOULD return the UTC calendar day', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T23:30:00Z'));

  expect(today()).toBe('2026-11-09');

  jest.useRealTimers();
});

describe('todayInSaoPaulo', () => {
  it('SHOULD return the São Paulo calendar day, one day behind UTC after 21:00', async () => {
    const { todayInSaoPaulo } = await import('./index');

    expect(todayInSaoPaulo(new Date('2026-11-10T02:00:00Z'))).toBe('2026-11-09');
    expect(todayInSaoPaulo(new Date('2026-11-10T15:00:00Z'))).toBe('2026-11-10');
  });
});
