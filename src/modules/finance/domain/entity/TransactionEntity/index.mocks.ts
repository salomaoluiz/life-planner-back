import TransactionEntity, { TransactionType } from './index';

// region Mocks

const paramsMock: TransactionEntity = {
  category: 'Food',
  date: '2023-10-27T10:00:00Z',
  description: 'Lunch at restaurant',
  id: 'uuid-1234-5678',
  ownerId: 'owner-uuid-0001',
  type: TransactionType.EXPENSE,
  value: '45.50',
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(params = paramsMock) {
  return new TransactionEntity(params);
}

const mocks = {
  params: paramsMock,
};

const spies = {};

export { mocks, setup, spies };
