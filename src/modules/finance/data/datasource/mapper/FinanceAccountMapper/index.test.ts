import { FinanceAccountMapper } from './index';
import { mocks } from './index.mocks';

describe('FinanceAccountMapper', () => {
  describe('toDomain', () => {
    it('SHOULD map every column to the entity (negative balance kept as-is)', () => {
      const result = FinanceAccountMapper.toDomain(mocks.raw);

      expect(result).toEqual({
        balance: -2500,
        createdAt: mocks.raw.created_at,
        icon: mocks.raw.icon,
        id: mocks.raw.id,
        name: mocks.raw.name,
        owner: 'FAMILY',
        ownerId: mocks.raw.owner_id,
        status: 'ARCHIVED',
        updatedAt: mocks.raw.updated_at,
      });
    });
  });
});
