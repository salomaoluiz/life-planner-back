import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import TagEntity from './index';

// region Mocks

const paramsMock: TagEntity = {
  allScopes: false,
  createdAt: new Date('2026-10-20T12:00:00.000Z'),
  creatorId: 'owner-uuid-456',
  id: 'tag-uuid-123',
  name: 'gasto-fixo',
  owner: OwnerType.FAMILY,
  ownerId: 'owner-uuid-456',
  scopes: [{ owner: OwnerType.FAMILY, ownerId: 'owner-uuid-456' }],
  updatedAt: new Date('2026-10-20T13:00:00.000Z'),
  usageCount: 3,
};

// endregion Mocks

function setup(params = paramsMock) {
  return new TagEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
