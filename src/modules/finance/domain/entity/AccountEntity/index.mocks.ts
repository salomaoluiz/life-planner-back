import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import AccountEntity from './index';

// region Mocks

const paramsMock: AccountEntity = {
  balance: 152075,
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  icon: 'bank',
  id: 'account-uuid-123',
  name: 'Checking',
  owner: OwnerType.USER,
  ownerId: 'owner-uuid-456',
  status: AccountStatus.ACTIVE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};

// endregion Mocks

function setup(params = paramsMock) {
  return new AccountEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
