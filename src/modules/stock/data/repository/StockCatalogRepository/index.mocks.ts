import { Test } from '@nestjs/testing';

import { StockMapper } from '@stock/data/datasource/mapper/StockMapper';

import { StockCatalogRepository } from './index';

jest.mock('@stock/data/datasource/mapper/StockMapper');

const datasource = {
  countItemsByCategory: jest.fn(),
  countItemsByLocation: jest.fn(),
  createCategories: jest.fn(),
  createCategory: jest.fn(),
  createLocation: jest.fn(),
  createLocations: jest.fn(),
  deleteByOwner: jest.fn(),
  deleteCategory: jest.fn(),
  deleteLocation: jest.fn(),
  findCatalogByOwners: jest.fn(),
  findCategories: jest.fn(),
  findCategoryById: jest.fn(),
  findLocationById: jest.fn(),
  findLocations: jest.fn(),
  setCategoryStatus: jest.fn(),
  updateCategory: jest.fn(),
  updateLocation: jest.fn(),
};
const spies = {
  toCategory: jest.mocked(StockMapper.toCategory),
  toLocation: jest.mocked(StockMapper.toLocation),
};
let setup: StockCatalogRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  spies.toCategory.mockReturnValue({ id: 'category' } as never);
  spies.toLocation.mockReturnValue({ id: 'location' } as never);

  const module = await Test.createTestingModule({
    providers: [
      StockCatalogRepository,
      { provide: 'IStockCatalogDatasource', useValue: datasource },
    ],
  }).compile();

  setup = module.get(StockCatalogRepository);
});

export { datasource, setup, spies };
