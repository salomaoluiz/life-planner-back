import { assertAccounts, assertDates, resolveAmountIn, TransferRuleError } from './index';

const base = { amountOut: 100000, currencyIn: 'BRL', currencyOut: 'BRL', isSeriesOccurrence: false, paid: true };

it('SHOULD fill the amount in with the amount out for the same currency', () => {
  expect(resolveAmountIn(base)).toBe(100000);
  expect(resolveAmountIn({ ...base, amountIn: 100000 })).toBe(100000);
});

it('SHOULD throw TRANSFER_AMOUNT_MISMATCH when the same currency has different amounts', () => {
  expect(() => resolveAmountIn({ ...base, amountIn: 90000 })).toThrow(new TransferRuleError('TRANSFER_AMOUNT_MISMATCH'));
});

it('SHOULD require the amount in for different currencies when paid', () => {
  const input = { ...base, currencyIn: 'USD' };

  expect(() => resolveAmountIn(input)).toThrow(new TransferRuleError('TRANSFER_AMOUNT_IN_REQUIRED'));
  expect(resolveAmountIn({ ...input, amountIn: 92000 })).toBe(92000);
});

it('SHOULD require the amount in for different currencies when not paid, unless it is a series occurrence', () => {
  const input = { ...base, currencyIn: 'USD', paid: false };

  expect(() => resolveAmountIn(input)).toThrow(new TransferRuleError('TRANSFER_AMOUNT_IN_REQUIRED'));
  expect(resolveAmountIn({ ...input, isSeriesOccurrence: true })).toBeNull();
});

it('SHOULD refuse paying a series occurrence without the amount in', () => {
  expect(() => resolveAmountIn({ ...base, currencyIn: 'USD', isSeriesOccurrence: true })).toThrow(
    new TransferRuleError('TRANSFER_AMOUNT_IN_REQUIRED'),
  );
});

it('SHOULD throw TRANSFER_DATE_IN_BEFORE_OUT when the in date is earlier', () => {
  expect(() => assertDates('2026-11-05', '2026-11-04')).toThrow(new TransferRuleError('TRANSFER_DATE_IN_BEFORE_OUT'));
  expect(() => assertDates('2026-11-05', '2026-11-05')).not.toThrow();
});

it('SHOULD throw TRANSFER_SAME_ACCOUNT for equal accounts', () => {
  expect(() => assertAccounts('a', 'a')).toThrow(new TransferRuleError('TRANSFER_SAME_ACCOUNT'));
  expect(() => assertAccounts('a', 'b')).not.toThrow();
});
