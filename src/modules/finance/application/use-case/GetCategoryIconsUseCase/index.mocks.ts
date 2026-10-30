import { Test } from '@nestjs/testing';

import { CategoryIconEntity } from '@finance/domain/entity/CategoryIconEntity';

import { GetCategoryIconsUseCase } from './index';

// region Mocks

function icon(name: string, group: string, sort: number): CategoryIconEntity {
  return { common: false, group, labelEn: name, labelPt: name, name, sort };
}
const folder = icon('folder', 'OTHER', 1);
const food = icon('food', 'FOOD', 2);
const car = icon('car', 'TRANSPORT', 3);
const iconRepositoryMock = {
  listAll: jest.fn(),
  search: jest.fn(),
  searchSimilar: jest.fn(),
};

// endregion Mocks

let setup: GetCategoryIconsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  iconRepositoryMock.listAll.mockResolvedValue([folder, car, food]);
  iconRepositoryMock.search.mockResolvedValue([folder]);
  iconRepositoryMock.searchSimilar.mockResolvedValue([folder]);

  const module = await Test.createTestingModule({
    providers: [
      GetCategoryIconsUseCase,
      { provide: 'IFinanceCategoryIconRepository', useValue: iconRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetCategoryIconsUseCase);
});

const mocks = { car, folder, food, iconRepository: iconRepositoryMock };
const spies = {};

export { mocks, setup, spies };
