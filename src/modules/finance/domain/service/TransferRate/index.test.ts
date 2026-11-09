import { amountInFromRate, computeRate } from './index';

it('SHOULD show 5000 BRL for 920 USD as 1 USD = 5.4348 BRL, reading the direction that is at least 1', () => {
  expect(computeRate(500000, 92000)).toEqual({ base: 'IN', value: 5.4348 });
});

it('SHOULD show the inverse direction when the amount in is the larger one', () => {
  expect(computeRate(92000, 500000)).toEqual({ base: 'OUT', value: 5.4348 });
});

it('SHOULD give 1 for equal amounts AND null when the amount in is missing', () => {
  expect(computeRate(1000, 1000)).toEqual({ base: 'IN', value: 1 });
  expect(computeRate(1000, null)).toBeNull();
  expect(computeRate(1000, 0)).toBeNull();
});

it('SHOULD turn the rate 5.4348 on 5000 BRL into 92000 cents', () => {
  expect(amountInFromRate(500000, 5.4348)).toBe(92000);
});

it('SHOULD return null for a rate that is not positive', () => {
  expect(amountInFromRate(500000, 0)).toBeNull();
});
