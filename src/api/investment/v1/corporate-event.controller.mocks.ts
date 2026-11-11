import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CorporateEventController } from '@api/investment/v1/corporate-event.controller';
import { CorporateEventService } from '@api/investment/v1/corporate-event.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const resultMock = { item: { id: faker.string.uuid() } };

const serviceMock = {
  approveSuggestion: jest.fn().mockResolvedValue(resultMock),
  createFractionSale: jest.fn().mockResolvedValue(resultMock),
  findSuggestions: jest.fn().mockResolvedValue({ count: 0, items: [], nextCursor: null }),
  rejectSuggestion: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

let setup: CorporateEventController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [CorporateEventController],
    providers: [{ provide: CorporateEventService, useValue: serviceMock }],
  }).compile();

  setup = module.get(CorporateEventController);
});

const mocks = { request: requestMock, result: resultMock, service: serviceMock };

export { mocks, setup };
