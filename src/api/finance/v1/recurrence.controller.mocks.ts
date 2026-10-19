import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { RecurrenceController } from '@api/finance/v1/recurrence.controller';
import { RecurrenceService } from '@api/finance/v1/recurrence.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const outputMock = { recurrence: { id: faker.string.uuid() } };
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const serviceMock = {
  create: jest.fn(),
  delete: jest.fn(),
  deleteOccurrence: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  materializeOccurrence: jest.fn(),
  split: jest.fn(),
  update: jest.fn(),
};

// endregion Mocks

let setup: RecurrenceController;

beforeEach(async () => {
  jest.clearAllMocks();
  Object.values(serviceMock).forEach((fn) => fn.mockResolvedValue(outputMock));
  serviceMock.deleteOccurrence.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    controllers: [RecurrenceController],
    providers: [{ provide: RecurrenceService, useValue: serviceMock }],
  }).compile();

  setup = module.get(RecurrenceController);
});

const mocks = { output: outputMock, request: requestMock, service: serviceMock };
const spies = {};

export { mocks, setup, spies };
