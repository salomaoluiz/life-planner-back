import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceOwnerVersionDatasource } from './index';

const findManySpy = jest.fn();
const databaseMock = {
  client: { financeOwnerVersion: { findMany: findManySpy } },
} as unknown as Database;

let setup: FinanceOwnerVersionDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  findManySpy.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [FinanceOwnerVersionDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(FinanceOwnerVersionDatasource);
});

it('SHOULD read all the owners with ONE query', async () => {
  const owners = [
    { owner: 'USER' as const, owner_id: 'user-id' },
    { owner: 'FAMILY' as const, owner_id: 'family-id' },
  ];

  await setup.findMany(owners);

  expect(findManySpy).toHaveBeenCalledTimes(1);
  expect(findManySpy).toHaveBeenCalledWith({
    select: { owner: true, owner_id: true, version: true },
    where: { OR: owners },
  });
});

it('SHOULD NOT query WHEN there are no owners', async () => {
  expect(await setup.findMany([])).toEqual([]);
  expect(findManySpy).not.toHaveBeenCalled();
});
