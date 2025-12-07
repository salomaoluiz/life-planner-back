import FamilyEntity from './index';
import { mocks, setup } from './index.mocks';

describe('FamilyEntity', () => {
  it('SHOULD create an instance of FamilyEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(FamilyEntity);
    expect(result).toEqual(mocks.params);
  });
});
