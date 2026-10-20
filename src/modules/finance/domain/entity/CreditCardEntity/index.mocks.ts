import { AccountStatus, CreditCardBrand } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import CreditCardEntity from './index';

// region Mocks

const paramsMock: CreditCardEntity = {
  brand: CreditCardBrand.VISA,
  closingDay: 31,
  color: '#3B5BDB',
  createdAt: new Date('2026-10-14T12:00:00.000Z'),
  currency: 'BRL' as const,
  dueDay: 10,
  id: 'card-uuid-123',
  lastDigits: '1234',
  limit: 500000,
  owner: OwnerType.USER,
  ownerId: 'owner-uuid-456',
  paymentAccountId: 'account-id',
  paymentDay: 5,
  status: AccountStatus.ACTIVE,
  title: 'Main card',
  updatedAt: new Date('2026-10-14T13:00:00.000Z'),
};

// endregion Mocks

function setup(params = paramsMock) {
  return new CreditCardEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
