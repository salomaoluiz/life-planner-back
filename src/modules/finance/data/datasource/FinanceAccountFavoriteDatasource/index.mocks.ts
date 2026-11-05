import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceAccountFavoriteDatasource } from './index';

// region Spies

const deleteManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const upsertSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    financialAccountFavorite: {
      deleteMany: deleteManySpy,
      findUnique: findUniqueSpy,
      upsert: upsertSpy,
    },
  },
} as unknown as Database;

let setup: FinanceAccountFavoriteDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FinanceAccountFavoriteDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceAccountFavoriteDatasource>(FinanceAccountFavoriteDatasource);
});

const spies = { deleteMany: deleteManySpy, findUnique: findUniqueSpy, upsert: upsertSpy };

export { setup, spies };
