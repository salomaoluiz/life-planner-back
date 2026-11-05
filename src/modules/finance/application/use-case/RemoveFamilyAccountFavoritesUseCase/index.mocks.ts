import { Test } from '@nestjs/testing';

import { RemoveFamilyAccountFavoritesUseCase } from './index';

const favoriteRepositoryMock = { clearByFamilyForUsers: jest.fn().mockResolvedValue(undefined) };

let setup: RemoveFamilyAccountFavoritesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      RemoveFamilyAccountFavoritesUseCase,
      { provide: 'IFinanceAccountFavoriteRepository', useValue: favoriteRepositoryMock },
    ],
  }).compile();

  setup = module.get(RemoveFamilyAccountFavoritesUseCase);
});

const mocks = { favoriteRepository: favoriteRepositoryMock };

export { mocks, setup };
