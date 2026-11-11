import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { InvestmentController } from '@api/investment/v1/investment.controller';
import { InvestmentService } from '@api/investment/v1/investment.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const resultMock = { item: { id: faker.string.uuid() } };

const investmentServiceMock = {
  createAsset: jest.fn().mockResolvedValue(resultMock),
  createOperation: jest.fn().mockResolvedValue(resultMock),
  deleteAsset: jest.fn().mockResolvedValue(undefined),
  deleteOperation: jest.fn().mockResolvedValue(undefined),
  deleteValuation: jest.fn().mockResolvedValue(undefined),
  findAssetById: jest.fn().mockResolvedValue(resultMock),
  findAssets: jest.fn().mockResolvedValue({ items: [resultMock] }),
  getSummary: jest.fn().mockResolvedValue(resultMock),
  priceHistory: jest.fn().mockResolvedValue(resultMock),
  refreshQuotes: jest.fn().mockResolvedValue(resultMock),
  searchTickers: jest.fn().mockResolvedValue({ items: [] }),
  updateAsset: jest.fn().mockResolvedValue(resultMock),
  updateOperation: jest.fn().mockResolvedValue(resultMock),
  upsertValuation: jest.fn().mockResolvedValue(resultMock),
};

// endregion Mocks

let setup: InvestmentController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [InvestmentController],
    providers: [{ provide: InvestmentService, useValue: investmentServiceMock }],
  }).compile();

  setup = module.get(InvestmentController);
});

const mocks = { request: requestMock, result: resultMock, service: investmentServiceMock };
const spies = {};

export { mocks, setup, spies };
