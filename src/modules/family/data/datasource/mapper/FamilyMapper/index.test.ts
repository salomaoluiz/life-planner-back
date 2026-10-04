import { FamilyMapper } from './index';
import { mocks } from './index.mocks';

describe('FamilyMapper', () => {
  describe('toDomain', () => {
    it('SHOULD map every column to the entity', () => {
      const result = FamilyMapper.toDomain(mocks.raw);

      expect(result).toEqual({
        createdAt: mocks.raw.created_at,
        id: mocks.raw.id,
        name: mocks.raw.name,
        ownerId: mocks.raw.owner_id,
        updatedAt: mocks.raw.updated_at,
      });
    });
  });
});
