import { RecurrenceFrequency, RecurrenceStatus, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import RecurrenceEntity from './index';

// region Mocks

const paramsMock: RecurrenceEntity = {
  account: { icon: 'bank', id: 'account-uuid-1', name: 'Checking' },
  accountId: 'account-uuid-1',
  category: {
    excludeFromTotals: false,
    icon: 'home',
    iconColor: '#2E7D32',
    id: 'category-uuid-1',
    name: 'Rent',
    systemKey: null,
  },
  categoryId: 'category-uuid-1',
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  creditCard: null,
  creditCardId: null,
  description: 'Rent',
  endDate: '2027-09-05',
  firstNumber: 1,
  frequency: RecurrenceFrequency.MONTHLY,
  id: 'recurrence-uuid-1',
  lastGeneratedNumber: 1,
  nextOccurrenceDate: '2026-11-05',
  occurrenceCount: 12,
  owner: OwnerType.USER,
  ownerId: 'owner-uuid-1',
  skippedNumbers: [],
  startDate: '2026-10-05',
  status: RecurrenceStatus.ACTIVE,
  type: TransactionType.EXPENSE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
  value: 200000,
};

// endregion Mocks

function setup(params = paramsMock) {
  return new RecurrenceEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
