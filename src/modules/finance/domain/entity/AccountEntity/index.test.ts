import { AccountType } from '@finance/domain/enum';

import AccountEntity from './index';
import { mocks, setup } from './index.mocks';

describe('AccountEntity', () => {
  it('SHOULD create an instance of AccountEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(AccountEntity);
    expect(result).toEqual(mocks.params);
  });

  it('SHOULD default the type to CHECKING', () => {
    expect(setup({ ...mocks.params, type: undefined }).type).toBe(AccountType.CHECKING);
  });
});
