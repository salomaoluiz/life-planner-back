import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { MarketIndexController } from '@api/investment/v1/market-index.controller';
import { MarketIndexService } from '@api/investment/v1/market-index.service';
import { JwtPayload } from '@shared/infra/jwt/types';

const userId = faker.string.uuid();
const mocks = {
  request: { user: { id: userId } } as JwtPayload & Request,
  result: { cdi: null },
  service: {
    getHistory: jest.fn(),
    getSummary: jest.fn(),
    refresh: jest.fn(),
  },
  userId,
};

let setup: MarketIndexController;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.service.getHistory.mockResolvedValue(mocks.result);
  mocks.service.getSummary.mockResolvedValue(mocks.result);
  mocks.service.refresh.mockResolvedValue(mocks.result);

  const module = await Test.createTestingModule({
    controllers: [MarketIndexController],
    providers: [{ provide: MarketIndexService, useValue: mocks.service }],
  }).compile();

  setup = module.get(MarketIndexController);
});

export { mocks, setup };
