import { summarizeWaste } from '@stock/domain/service/WasteSummary';

it('SHOULD be null WHEN nothing was discarded', () => {
  expect(summarizeWaste([])).toBeNull();
});

it('SHOULD total quantity, count and value per currency AND pick the most frequent reason', () => {
  expect(
    summarizeWaste([
      { count: 2, currency: 'BRL', quantity: 3, reason: 'EXPIRED', valueCents: 600 },
      { count: 1, currency: 'EUR', quantity: 1, reason: 'EXPIRED', valueCents: 250 },
      { count: 1, quantity: 0.5, reason: 'SPOILED', valueCents: 0 },
    ]),
  ).toEqual({
    count: 4,
    mainReason: 'EXPIRED',
    quantity: 4.5,
    totals: [
      { currency: 'BRL', valueCents: 600 },
      { currency: 'EUR', valueCents: 250 },
    ],
  });
});

it('SHOULD break a reason tie by quantity', () => {
  expect(
    summarizeWaste([
      { count: 1, quantity: 1, reason: 'EXPIRED', valueCents: 0 },
      { count: 1, quantity: 5, reason: 'SPOILED', valueCents: 0 },
    ])?.mainReason,
  ).toBe('SPOILED');
});
