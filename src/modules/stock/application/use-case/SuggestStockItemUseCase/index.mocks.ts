import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  category,
  location,
  userId,
} from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { ConsumeAiUsageUseCase } from '../ConsumeAiUsageUseCase';
import { GetAiUsageUseCase } from '../GetAiUsageUseCase';
import { SuggestStockItemUseCase } from './index';

const usage = { light: { limit: 50, used: 1 }, search: { limit: 10, used: 0 } };
const mocks = {
  catalog: catalogRepositoryMock(),
  consume: { execute: jest.fn() },
  getUsage: { execute: jest.fn() },
  llm: { complete: jest.fn(), isEnabled: jest.fn() },
  off: { getProduct: jest.fn() },
  usage,
};
const base = {
  accessibleOwners,
  owner: OwnerType.USER,
  ownerId: userId,
  userId,
};
let setup: SuggestStockItemUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.catalog.findCatalogByOwners.mockResolvedValue({
    categories: [
      category('c1', { name: 'Laticínios' }),
      category('c2', { name: 'Doces', status: StockCatalogStatus.ARCHIVED }),
    ],
    locations: [location('l1', { name: 'Geladeira' })],
    shoppingLists: [],
  });
  mocks.consume.execute.mockResolvedValue(true);
  mocks.getUsage.execute.mockResolvedValue(usage);
  mocks.llm.isEnabled.mockReturnValue(true);
  mocks.llm.complete.mockResolvedValue(null);
  mocks.off.getProduct.mockResolvedValue(null);
  setup = await build(SuggestStockItemUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
    { provide: 'IOpenFoodFacts', useValue: mocks.off },
    { provide: 'ILlm', useValue: mocks.llm },
    { provide: ConsumeAiUsageUseCase, useValue: mocks.consume },
    { provide: GetAiUsageUseCase, useValue: mocks.getUsage },
  ]);
});

export { base, mocks, setup };
