import CreditCardEntity from './index';
import { mocks, setup } from './index.mocks';

describe('CreditCardEntity', () => {
  it('SHOULD create an instance of CreditCardEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(CreditCardEntity);
    expect(result).toEqual(mocks.params);
  });

  it('SHOULD keep paymentDay and lastDigits undefined WHEN they are not given', () => {
    const result = setup({ ...mocks.params, lastDigits: undefined, paymentDay: undefined });

    expect(result.paymentDay).toBeUndefined();
    expect(result.lastDigits).toBeUndefined();
  });
});
