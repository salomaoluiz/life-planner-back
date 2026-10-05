import AccountEntity from './index';
import { mocks, setup } from './index.mocks';

describe('AccountEntity', () => {
  it('SHOULD create an instance of AccountEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(AccountEntity);
    expect(result).toEqual(mocks.params);
  });
});
