import TransactionEntity, { TransactionType } from './index';
import { mocks, setup } from './index.mocks';

describe('TransactionEntity', () => {
  it('SHOULD create an instance of TransactionEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(TransactionEntity);
    expect(result).toEqual(mocks.params);
  });

  it('SHOULD create an instance with INCOME type WHEN provided', () => {
    const params = {
      ...mocks.params,
      type: TransactionType.INCOME,
    };

    const result = setup(params);

    expect(result.type).toBe(TransactionType.INCOME);
  });
});
