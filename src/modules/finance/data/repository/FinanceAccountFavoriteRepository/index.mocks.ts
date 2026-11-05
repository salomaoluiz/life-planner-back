import { Test } from '@nestjs/testing';

import { FinanceAccountFavoriteRepository } from './index';

const datasourceMock = {
  deleteByAccount: jest.fn(),
  deleteByFamily: jest.fn(),
  deleteForUser: jest.fn(),
  findByUser: jest.fn(),
  upsert: jest.fn(),
};

let setup: FinanceAccountFavoriteRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      FinanceAccountFavoriteRepository,
      { provide: 'IFinanceAccountFavoriteDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get<FinanceAccountFavoriteRepository>(FinanceAccountFavoriteRepository);
});

const mocks = { datasource: datasourceMock };

export { mocks, setup };
