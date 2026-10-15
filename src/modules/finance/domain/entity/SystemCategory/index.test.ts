import { z } from 'zod';

import { BALANCE_ADJUSTMENT_DESCRIPTION, isSystemCategoryId, SYSTEM_CATEGORY_IDS } from './index';
import { mocks } from './index.mocks';

it('SHOULD give every system key a fixed id that passes the API uuid validation', () => {
  expect(z.uuid().safeParse(SYSTEM_CATEGORY_IDS[mocks.key]).success).toBe(true);
  expect(SYSTEM_CATEGORY_IDS[mocks.key]).toBe('00000000-0000-4000-8000-000000000001');
});

it('SHOULD recognise a system id AND reject any other id', () => {
  expect(isSystemCategoryId(SYSTEM_CATEGORY_IDS[mocks.key])).toBe(true);
  expect(isSystemCategoryId(mocks.unknownId)).toBe(false);
  expect(isSystemCategoryId('')).toBe(false);
});

it('SHOULD keep the fixed adjustment description', () => {
  expect(BALANCE_ADJUSTMENT_DESCRIPTION).toBe('Balance adjustment');
});
