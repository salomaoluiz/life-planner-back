import { ConflictException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { location } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  language: 'pt-BR' as const,
  owner: OwnerType.USER,
  ownerId: 'user-id',
};

it('SHOULD create the five defaults in the requested language', async () => {
  await setup.execute(input);

  expect(
    mocks.catalog.createLocations.mock.calls[0][0].map((row: { name: string }) => row.name),
  ).toEqual(['Despensa', 'Geladeira', 'Freezer', 'Área de serviço', 'Garagem']);
});

it('SHOULD answer 409 WHEN the owner already has locations', async () => {
  mocks.catalog.findLocations.mockResolvedValue([location('a')]);

  await expect(setup.execute(input)).rejects.toThrow(ConflictException);
});
