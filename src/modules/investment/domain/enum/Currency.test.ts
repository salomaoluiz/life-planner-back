import { SUPPORTED_CURRENCIES as FINANCE_CURRENCIES } from '@finance/domain/enum/Currency';

import { SUPPORTED_CURRENCIES } from './Currency';

it('SHOULD list the same currencies as finance', () => {
  expect([...SUPPORTED_CURRENCIES]).toEqual([...FINANCE_CURRENCIES]);
});
