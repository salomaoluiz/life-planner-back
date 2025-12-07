import OwnerEntity, { OwnerType } from './OwnerEntity';
import { mocks, setup } from './OwnerEntity.mocks';

describe('OwnerEntity', () => {
  it('SHOULD create an instance of OwnerEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(OwnerEntity);
    expect(result.id).toBe(mocks.params.id);
    expect(result.ownerId).toBe(mocks.params.ownerId);
    expect(result.type).toBe(mocks.params.type);
  });

  it('SHOULD create an instance with FAMILY type WHEN provided', () => {
    const params = {
      ...mocks.params,
      type: OwnerType.FAMILY,
    };

    const result = setup(params);

    expect(result.type).toBe(OwnerType.FAMILY);
  });
});
