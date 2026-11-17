import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { IncomeSeriesController } from '@api/investment/v1/income-series.controller';
import { IncomeSeriesService } from '@api/investment/v1/income-series.service';
import { JwtPayload } from '@shared/infra/jwt/types';

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const resultMock = { item: { id: faker.string.uuid() } };

const serviceMock = {
  create: jest.fn().mockResolvedValue(resultMock),
  findById: jest.fn().mockResolvedValue(resultMock),
  list: jest.fn().mockResolvedValue({ items: [] }),
  preview: jest.fn().mockResolvedValue({}),
  projections: jest.fn().mockResolvedValue({ items: [] }),
  update: jest.fn().mockResolvedValue(resultMock),
};

let setup: IncomeSeriesController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [IncomeSeriesController],
    providers: [{ provide: IncomeSeriesService, useValue: serviceMock }],
  }).compile();

  setup = module.get(IncomeSeriesController);
});

const mocks = { request: requestMock, result: resultMock, service: serviceMock };

export { mocks, setup };
