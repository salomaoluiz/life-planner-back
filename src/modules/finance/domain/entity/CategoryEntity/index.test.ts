import CategoryEntity from './index';
import { mocks, setup } from './index.mocks';

describe('CategoryEntity', () => {
  it('SHOULD create an instance of CategoryEntity with all properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(CategoryEntity);
    expect(result).toEqual(mocks.params);
    expect(result.depthLevel).toBe(mocks.params.depthLevel);
    expect(result.parentId).toBe(mocks.params.parentId);
  });

  it('SHOULD create an instance with only mandatory properties AND optional properties undefined', () => {
    const result = setup(mocks.mandatoryParams);

    expect(result).toBeInstanceOf(CategoryEntity);
    expect(result.id).toBe(mocks.mandatoryParams.id);
    expect(result.name).toBe(mocks.mandatoryParams.name);

    // Validating optional properties are undefined
    expect(result.depthLevel).toBeUndefined();
    expect(result.parentId).toBeUndefined();
  });
});
