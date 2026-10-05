import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import CategoryEntity from './index';

// region Mocks

const paramsMock: CategoryEntity = {
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  depthLevel: 1,
  icon: 'cart',
  iconColor: '#2E7D32',
  id: 'category-uuid-123',
  name: 'Groceries',
  owner: OwnerType.FAMILY,
  ownerId: 'owner-uuid-456',
  parentId: 'parent-uuid-789',
  type: TransactionType.EXPENSE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};

// endregion Mocks

function setup(params = paramsMock) {
  return new CategoryEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
