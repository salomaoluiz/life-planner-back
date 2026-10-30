import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceCategoryIconDatasource } from './index';

// region Mocks

const rowMock = {
  common: true,
  group_key: 'OTHER',
  label_en: 'Folder',
  label_pt: 'Pasta',
  name: 'folder',
  sort: 1,
};

// endregion Mocks

// region Spies

const findManySpy = jest.fn();
const queryRawSpy = jest.fn();

// endregion Spies

let setup: FinanceCategoryIconDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  findManySpy.mockResolvedValue([rowMock]);
  queryRawSpy.mockResolvedValue([rowMock]);

  const module = await Test.createTestingModule({
    providers: [
      FinanceCategoryIconDatasource,
      {
        provide: Database,
        useValue: { client: { $queryRaw: queryRawSpy, categoryIcon: { findMany: findManySpy } } },
      },
    ],
  }).compile();

  setup = module.get(FinanceCategoryIconDatasource);
});

const mocks = { row: rowMock };
const spies = { findMany: findManySpy, queryRaw: queryRawSpy };

export { mocks, setup, spies };
