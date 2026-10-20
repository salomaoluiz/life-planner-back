import TagEntity from './index';
import { mocks, setup } from './index.mocks';

describe('TagEntity', () => {
  it('SHOULD create an instance of TagEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(TagEntity);
    expect(result).toEqual(mocks.params);
  });

  it('SHOULD default the usage count to 0', () => {
    expect(setup({ ...mocks.params, usageCount: undefined } as never).usageCount).toBe(0);
  });
});
