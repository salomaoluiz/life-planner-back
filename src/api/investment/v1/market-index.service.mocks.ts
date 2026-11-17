import { Test } from '@nestjs/testing';

import { MarketIndexService } from '@api/investment/v1/market-index.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { GetMarketIndexesUseCase } from '@investment/application/use-case/GetMarketIndexesUseCase';
import { GetMarketIndexHistoryUseCase } from '@investment/application/use-case/GetMarketIndexHistoryUseCase';
import { RefreshMarketIndexesNowUseCase } from '@investment/application/use-case/RefreshMarketIndexesNowUseCase';

const spies = {
  families: jest.fn(),
  history: jest.fn(),
  refresh: jest.fn(),
  summary: jest.fn(),
};

let setup: MarketIndexService;

beforeEach(async () => {
  jest.resetAllMocks();
  spies.families.mockResolvedValue([{ archived: true, familyId: 'family-1' }]);

  const module = await Test.createTestingModule({
    providers: [
      MarketIndexService,
      { provide: GetMarketIndexesUseCase, useValue: { execute: spies.summary } },
      { provide: GetMarketIndexHistoryUseCase, useValue: { execute: spies.history } },
      { provide: GetUserFamilyAccessUseCase, useValue: { execute: spies.families } },
      { provide: RefreshMarketIndexesNowUseCase, useValue: { execute: spies.refresh } },
    ],
  }).compile();

  setup = module.get(MarketIndexService);
});

export { setup, spies };
