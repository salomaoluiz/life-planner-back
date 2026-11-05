import { Test } from '@nestjs/testing';

import { GetAccountFavoriteUseCase } from './index';

const favoriteRepositoryMock = { findByUser: jest.fn() };

let setup: GetAccountFavoriteUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetAccountFavoriteUseCase,
      { provide: 'IFinanceAccountFavoriteRepository', useValue: favoriteRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetAccountFavoriteUseCase);
});

const mocks = { favoriteRepository: favoriteRepositoryMock };

export { mocks, setup };
