import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CreditCardController } from '@api/finance/v1/credit-card.controller';
import { CreditCardService } from '@api/finance/v1/credit-card.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const cardApiMock = {
  brand: 'VISA',
  closingDay: 31,
  color: '#3B5BDB',
  createdAt: '2026-10-14T12:00:00.000Z',
  dueDay: 10,
  id: faker.string.uuid(),
  limit: 500000,
  owner: 'USER',
  ownerId: userId,
  status: 'ACTIVE',
  title: 'Main card',
  updatedAt: '2026-10-14T12:00:00.000Z',
};
const requestMock = { user: { id: userId } } as JwtPayload & Request;

const creditCardServiceMock = {
  create: jest.fn().mockResolvedValue(cardApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([cardApiMock]),
  findOne: jest.fn().mockResolvedValue(cardApiMock),
  findOverview: jest.fn().mockResolvedValue({ aggregate: {}, cards: [] }),
  update: jest.fn().mockResolvedValue(cardApiMock),
};

// endregion Mocks

let setup: CreditCardController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [CreditCardController],
    providers: [{ provide: CreditCardService, useValue: creditCardServiceMock }],
  }).compile();

  setup = module.get(CreditCardController);
});

const mocks = { card: cardApiMock, creditCardService: creditCardServiceMock, request: requestMock };
const spies = {};

export { mocks, setup, spies };
