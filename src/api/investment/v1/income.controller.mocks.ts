import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { IncomeController } from '@api/investment/v1/income.controller';
import { IncomeService } from '@api/investment/v1/income.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const resultMock = { item: { id: faker.string.uuid() } };

const incomeServiceMock = {
  approveSuggestion: jest.fn().mockResolvedValue(resultMock),
  createIncome: jest.fn().mockResolvedValue(resultMock),
  deleteIncome: jest.fn().mockResolvedValue(undefined),
  findDefaults: jest.fn().mockResolvedValue(resultMock),
  findIncomeById: jest.fn().mockResolvedValue(resultMock),
  findIncomes: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
  findSuggestions: jest.fn().mockResolvedValue({ count: 0, items: [] }),
  receiveIncome: jest.fn().mockResolvedValue(resultMock),
  rejectSuggestion: jest.fn().mockResolvedValue(undefined),
  updateIncome: jest.fn().mockResolvedValue(resultMock),
};

// endregion Mocks

let setup: IncomeController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [IncomeController],
    providers: [{ provide: IncomeService, useValue: incomeServiceMock }],
  }).compile();

  setup = module.get(IncomeController);
});

const mocks = { request: requestMock, result: resultMock, service: incomeServiceMock };

export { mocks, setup };
