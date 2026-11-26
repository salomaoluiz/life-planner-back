import { isMultipleOfTick, isSummaryInsideQuiet } from './index';

it('SHOULD refuse a summary time inside quiet hours (also when they cross midnight)', () => {
  expect(isSummaryInsideQuiet(1380, 1320, 420)).toBe(true);
  expect(isSummaryInsideQuiet(480, 1320, 420)).toBe(false);
  expect(isSummaryInsideQuiet(480, 600, 600)).toBe(false);
});

it('SHOULD require a multiple of the tick interval', () => {
  expect(isMultipleOfTick(495, 15)).toBe(true);
  expect(isMultipleOfTick(490, 15)).toBe(false);
});
