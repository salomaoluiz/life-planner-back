import TransactionEntity from './index';
import { mocks, setup } from './index.mocks';

describe('TransactionEntity', () => {
  it('SHOULD create an instance of TransactionEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(TransactionEntity);
    expect(result).toEqual(mocks.params);
  });
});
