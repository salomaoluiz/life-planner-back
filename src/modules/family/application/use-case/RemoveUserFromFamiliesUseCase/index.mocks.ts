import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { RemoveUserFromFamiliesUseCase } from './index';

// region Mocks

const familyRepositoryMock = { removeUser: jest.fn() };

// endregion Mocks

let setup: RemoveUserFromFamiliesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  familyRepositoryMock.removeUser.mockResolvedValue({ families: 1, memberships: 2 });

  const module = await Test.createTestingModule({
    providers: [
      RemoveUserFromFamiliesUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(RemoveUserFromFamiliesUseCase);
});

const mocks = { familyRepository: familyRepositoryMock, userId: faker.string.uuid() };
const spies = {};

export { mocks, setup, spies };
