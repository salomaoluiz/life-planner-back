import CategoryEntity from './index';
import { mocks, setup } from './index.mocks';

describe('CategoryEntity', () => {
  it('SHOULD create an instance of CategoryEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(CategoryEntity);
    expect(result).toEqual(mocks.params);
  });

  it('SHOULD leave parentId undefined for a root category', () => {
    const result = setup({ ...mocks.params, parentId: undefined });

    expect(result.parentId).toBeUndefined();
  });

  it('SHOULD default the status to ACTIVE', () => {
    expect(setup({ ...mocks.params, status: undefined } as never).status).toBe('ACTIVE');
  });
});
