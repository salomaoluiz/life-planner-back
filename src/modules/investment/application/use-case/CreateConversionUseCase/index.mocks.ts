import { Test } from '@nestjs/testing';

import {
  quoteProviders,
  quoteSpies,
} from '@investment/application/service/QuoteContext/index.mocks';
import {
  conversionScenario,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateConversionUseCase } from './index';

export const spies = repositorySpies();
export { quoteSpies };

export const mocks = {
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  scenario: conversionScenario,
};

export let setup: CreateConversionUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  quoteSpies.load.mockResolvedValue(undefined);
  spies.findConversionsByAssetIds.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      CreateConversionUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(CreateConversionUseCase);
});
