import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { StockController } from '@api/stock/v1/stock.controller';
import { StockService } from '@api/stock/v1/stock.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const itemApiMock = {
  barcode: null,
  brand: null,
  createdAt: '2026-10-04T12:00:00.000Z',
  description: 'Rice',
  expirationDate: null,
  id: faker.string.uuid(),
  notes: null,
  openingDate: null,
  owner: 'USER',
  ownerId: userId,
  purchaseDate: null,
  quantity: 2,
  unit: 'kilogram',
  updatedAt: '2026-10-04T12:00:00.000Z',
};
const requestMock = { user: { id: userId } } as JwtPayload & Request;

const stockServiceMock = {
  create: jest.fn().mockResolvedValue(itemApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([itemApiMock]),
  findById: jest.fn().mockResolvedValue(itemApiMock),
  update: jest.fn().mockResolvedValue(itemApiMock),
};

// endregion Mocks

let setup: StockController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [StockController],
    providers: [{ provide: StockService, useValue: stockServiceMock }],
  }).compile();

  setup = module.get(StockController);
});

const mocks = { item: itemApiMock, request: requestMock, stockService: stockServiceMock };
const spies = {};

export { mocks, setup, spies };
