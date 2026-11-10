import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FixedIncomeController } from '@api/investment/v1/fixed-income.controller';
import { FixedIncomeService } from '@api/investment/v1/fixed-income.service';
import { JwtPayload } from '@shared/infra/jwt/types';

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const resultMock = { item: { id: faker.string.uuid() } };

const serviceMock = {
  createContribution: jest.fn(),
  createRate: jest.fn(),
  createRedemption: jest.fn(),
  createTitle: jest.fn(),
  deleteAdjustment: jest.fn(),
  deleteRate: jest.fn(),
  previewRedemption: jest.fn(),
  simulate: jest.fn(),
  updateRate: jest.fn(),
  upsertAdjustment: jest.fn(),
  upsertTerms: jest.fn(),
};

export let setup: FixedIncomeController;

beforeEach(async () => {
  jest.resetAllMocks();
  Object.values(serviceMock).forEach((mock) => mock.mockResolvedValue(resultMock));

  const module = await Test.createTestingModule({
    controllers: [FixedIncomeController],
    providers: [{ provide: FixedIncomeService, useValue: serviceMock }],
  }).compile();

  setup = module.get(FixedIncomeController);
});

export const mocks = { request: requestMock, result: resultMock, service: serviceMock };
