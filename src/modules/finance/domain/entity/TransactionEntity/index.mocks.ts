import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import TransactionEntity from './index';

// region Mocks

const paramsMock: TransactionEntity = {
  account: { icon: 'bank', id: 'account-uuid-1', name: 'Checking' },
  accountId: 'account-uuid-1',
  category: { icon: 'cart', iconColor: '#2E7D32', id: 'category-uuid-1', name: 'Groceries' },
  categoryId: 'category-uuid-1',
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  date: '2026-10-03',
  description: 'Weekly groceries',
  id: 'transaction-uuid-1',
  owner: OwnerType.USER,
  ownerId: 'owner-uuid-1',
  type: TransactionType.EXPENSE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
  value: 23490,
};

// endregion Mocks

function setup(params = paramsMock) {
  return new TransactionEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
