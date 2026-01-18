import UserEntity from './index';
import { mocks, setup } from './index.mocks';

describe('UserEntity', () => {
  it('SHOULD create an instance of UserEntity with all properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(UserEntity);
    expect(result).toEqual(mocks.params);
  });

  it('SHOULD create an instance with only mandatory properties AND optional properties undefined', () => {
    const result = setup(mocks.mandatoryParams);

    expect(result).toBeInstanceOf(UserEntity);
    expect(result.id).toBe(mocks.mandatoryParams.id);

    // Validating optional properties are undefined
    expect(result.photoUrl).toBeUndefined();
  });
});
