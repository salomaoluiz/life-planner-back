import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { FinanceOwnerVersionRepository } from './index';

const datasourceMock = { findMany: jest.fn() };
const owners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];

let setup: FinanceOwnerVersionRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      FinanceOwnerVersionRepository,
      { provide: 'IFinanceOwnerVersionDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get(FinanceOwnerVersionRepository);
});

it('SHOULD return the versions in the order of the owners AND 0 for an owner never written', async () => {
  datasourceMock.findMany.mockResolvedValue([
    { owner: 'FAMILY', owner_id: 'family-id', version: BigInt(7) },
  ]);

  expect(await setup.findVersions(owners)).toEqual([0, 7]);
  expect(datasourceMock.findMany).toHaveBeenCalledWith([
    { owner: 'USER', owner_id: 'user-id' },
    { owner: 'FAMILY', owner_id: 'family-id' },
  ]);
});
