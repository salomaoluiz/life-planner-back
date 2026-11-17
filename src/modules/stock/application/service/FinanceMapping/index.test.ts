import { UnprocessableEntityException } from '@nestjs/common';

import { assertFinanceMapping } from './index';

const usable = [
  { archived: false, id: 'ok', isExpense: true },
  { archived: false, id: 'income', isExpense: false },
  { archived: true, id: 'archived', isExpense: true },
];

it.each([undefined, null, ''])('SHOULD accept no mapping (%j)', (value) => {
  expect(() => assertFinanceMapping(value, undefined)).not.toThrow();
});

it('SHOULD accept an active expense category', () => {
  expect(() => assertFinanceMapping('ok', usable)).not.toThrow();
});

it.each(['income', 'archived', 'unknown'])('SHOULD refuse %s with 422', (id) => {
  expect(() => assertFinanceMapping(id, usable)).toThrow(UnprocessableEntityException);
  expect(() => assertFinanceMapping('ok', undefined)).toThrow(UnprocessableEntityException);
});
