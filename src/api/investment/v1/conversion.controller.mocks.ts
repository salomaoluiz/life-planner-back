import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { ConversionController } from '@api/investment/v1/conversion.controller';
import { ConversionService } from '@api/investment/v1/conversion.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const resultMock = { item: { id: faker.string.uuid() } };

const serviceMock = {
  create: jest.fn().mockResolvedValue(resultMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(resultMock),
  update: jest.fn().mockResolvedValue(resultMock),
};

// endregion Mocks

let setup: ConversionController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [ConversionController],
    providers: [{ provide: ConversionService, useValue: serviceMock }],
  }).compile();

  setup = module.get(ConversionController);
});

const mocks = { request: requestMock, result: resultMock, service: serviceMock };

export { mocks, setup };
