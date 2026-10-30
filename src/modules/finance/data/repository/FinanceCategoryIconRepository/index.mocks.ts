import { Test } from '@nestjs/testing';

import { FinanceCategoryIconRepository } from './index';

// region Mocks

const rowMock = {
  common: true,
  group_key: 'OTHER',
  label_en: 'Folder',
  label_pt: 'Pasta',
  name: 'folder',
  sort: 1,
};
const entityMock = {
  common: true,
  group: 'OTHER',
  labelEn: 'Folder',
  labelPt: 'Pasta',
  name: 'folder',
  sort: 1,
};
const datasourceMock = {
  listAll: jest.fn(),
  search: jest.fn(),
  searchSimilar: jest.fn(),
};

// endregion Mocks

let setup: FinanceCategoryIconRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  datasourceMock.listAll.mockResolvedValue([rowMock]);
  datasourceMock.search.mockResolvedValue([rowMock]);
  datasourceMock.searchSimilar.mockResolvedValue([rowMock]);

  const module = await Test.createTestingModule({
    providers: [
      FinanceCategoryIconRepository,
      { provide: 'IFinanceCategoryIconDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get(FinanceCategoryIconRepository);
});

const mocks = { datasource: datasourceMock, entity: entityMock };
const spies = {};

export { mocks, setup, spies };
