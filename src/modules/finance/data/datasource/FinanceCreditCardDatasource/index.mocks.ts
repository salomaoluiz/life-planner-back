import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialCreditCard } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { FinanceCreditCardDatasource } from './index';

// region Mocks

const cardMock: FinancialCreditCard = {
  archived_at: null,
  brand: 'VISA',
  closing_day: 31,
  color: '#3B5BDB',
  created_at: faker.date.past(),
  currency: 'BRL' as const,
  due_day: 10,
  id: faker.string.uuid(),
  last_digits: '1234',
  limit: 500000,
  owner: 'USER',
  owner_id: faker.string.uuid(),
  payment_account_id: null,
  payment_day: 5,
  status: 'ACTIVE',
  title: 'Main card',
  updated_at: faker.date.recent(),
};

const ownersMock = [
  { owner: OwnerType.USER, ownerId: cardMock.owner_id },
  { owner: OwnerType.FAMILY, ownerId: faker.string.uuid() },
];

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const updateSpy = jest.fn();
const queryRawSpy = jest.fn();
const transactionSpy = jest.fn();
const paymentFindManySpy = jest.fn();
const planFindManySpy = jest.fn();
const txUpdateSpy = jest.fn();
const txFindManySpy = jest.fn();
const txUpdateManySpy = jest.fn();

// endregion Spies

const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialCreditCard: {
    create: createSpy,
    deleteMany: deleteManySpy,
    findFirst: findFirstSpy,
    findMany: findManySpy,
    findUnique: findUniqueSpy,
    update: updateSpy,
  },
  financialInstallmentPlan: { findMany: planFindManySpy },
  financialInvoicePayment: { findMany: paymentFindManySpy },
  financialTransaction: {
    findMany: txFindManySpy,
    update: txUpdateSpy,
    updateMany: txUpdateManySpy,
  },
};
const databaseMock = { client: clientMock } as unknown as Database;

let setup: FinanceCreditCardDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  planFindManySpy.mockResolvedValue([]);
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );

  const module = await Test.createTestingModule({
    providers: [FinanceCreditCardDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceCreditCardDatasource>(FinanceCreditCardDatasource);
});

const mocks = { card: cardMock, owners: ownersMock };
const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  paymentFindMany: paymentFindManySpy,
  planFindMany: planFindManySpy,
  queryRaw: queryRawSpy,
  transaction: transactionSpy,
  txFindMany: txFindManySpy,
  txUpdate: txUpdateSpy,
  txUpdateMany: txUpdateManySpy,
  update: updateSpy,
};

export { mocks, setup, spies };
