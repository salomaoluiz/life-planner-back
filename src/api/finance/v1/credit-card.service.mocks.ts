import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CreditCardService } from '@api/finance/v1/credit-card.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateCreditCardUseCase } from '@finance/application/use-case/CreateCreditCardUseCase';
import { DeleteCreditCardUseCase } from '@finance/application/use-case/DeleteCreditCardUseCase';
import { GetCreditCardByIdUseCase } from '@finance/application/use-case/GetCreditCardByIdUseCase';
import { GetCreditCardsOverviewUseCase } from '@finance/application/use-case/GetCreditCardsOverviewUseCase';
import { GetCreditCardsUseCase } from '@finance/application/use-case/GetCreditCardsUseCase';
import { UpdateCreditCardUseCase } from '@finance/application/use-case/UpdateCreditCardUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const cardResultMock = {
  brand: 'VISA',
  closingDay: 31,
  color: '#3B5BDB',
  createdAt: new Date('2026-10-14T12:00:00.000Z'),
  dueDay: 10,
  id: faker.string.uuid(),
  lastDigits: '1234',
  limit: 500000,
  owner: OwnerType.USER,
  ownerId: userId,
  paymentDay: 5,
  status: 'ACTIVE',
  title: 'Main card',
  updatedAt: new Date('2026-10-14T13:00:00.000Z'),
};
const cardApiMock = {
  ...cardResultMock,
  createdAt: '2026-10-14T12:00:00.000Z',
  owner: 'USER',
  updatedAt: '2026-10-14T13:00:00.000Z',
};
const invoiceMock = {
  amount: 0,
  closingDate: '2026-10-31',
  dueDate: '2026-11-10',
  paymentAfterDue: false,
  paymentDate: '2026-11-05',
  periodEnd: '2026-10-31',
  periodStart: '2026-10-01',
  referenceMonth: '2026-10',
  status: 'OPEN',
};
const overviewResultMock = {
  aggregate: { available: 500000, totalLimit: 500000, used: 0 },
  cards: [
    {
      available: 500000,
      card: cardResultMock,
      closedInvoices: [],
      openInvoice: invoiceMock,
      used: 0,
    },
  ],
};
const overviewApiMock = {
  ...overviewResultMock,
  cards: [{ ...overviewResultMock.cards[0], card: cardApiMock }],
};
const createBodyMock = {
  brand: 'VISA',
  closingDay: 31,
  color: '#3B5BDB',
  dueDay: 10,
  limit: 500000,
  owner: 'USER',
  ownerId: userId,
  status: 'ACTIVE',
  title: 'Main card',
};

const createUseCaseMock = { execute: jest.fn().mockResolvedValue(cardResultMock) };
const deleteUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getByIdUseCaseMock = { execute: jest.fn().mockResolvedValue(cardResultMock) };
const getUseCaseMock = { execute: jest.fn().mockResolvedValue([cardResultMock]) };
const overviewUseCaseMock = { execute: jest.fn().mockResolvedValue(overviewResultMock) };
const updateUseCaseMock = { execute: jest.fn().mockResolvedValue(cardResultMock) };

// endregion Mocks

let setup: CreditCardService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreditCardService,
      { provide: CreateCreditCardUseCase, useValue: createUseCaseMock },
      { provide: DeleteCreditCardUseCase, useValue: deleteUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetCreditCardByIdUseCase, useValue: getByIdUseCaseMock },
      { provide: GetCreditCardsOverviewUseCase, useValue: overviewUseCaseMock },
      { provide: GetCreditCardsUseCase, useValue: getUseCaseMock },
      { provide: UpdateCreditCardUseCase, useValue: updateUseCaseMock },
    ],
  }).compile();

  setup = module.get(CreditCardService);
});

const mocks = {
  accessibleOwners,
  cardApi: cardApiMock,
  createBody: createBodyMock,
  createUseCase: createUseCaseMock,
  deleteUseCase: deleteUseCaseMock,
  financeAccessService: financeAccessServiceMock,
  getByIdUseCase: getByIdUseCaseMock,
  getUseCase: getUseCaseMock,
  overviewApi: overviewApiMock,
  overviewUseCase: overviewUseCaseMock,
  updateUseCase: updateUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
