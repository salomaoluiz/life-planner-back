import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetOwnerDataVersionsUseCase } from './index';

const repositoryMock = { findVersions: jest.fn() };
const owners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];

let setup: GetOwnerDataVersionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  repositoryMock.findVersions.mockResolvedValue([5]);

  const module = await Test.createTestingModule({
    providers: [
      GetOwnerDataVersionsUseCase,
      { provide: 'IFinanceOwnerVersionRepository', useValue: repositoryMock },
    ],
  }).compile();

  setup = module.get(GetOwnerDataVersionsUseCase);
});

it('SHOULD return the versions the repository read, in order', async () => {
  expect(await setup.execute(owners)).toEqual([5]);
  expect(repositoryMock.findVersions).toHaveBeenCalledWith(owners);
});
