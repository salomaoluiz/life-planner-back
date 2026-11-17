import { ConflictException, NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { location } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  name: 'Pantry',
  owner: OwnerType.USER,
  ownerId: 'user-id',
};

it('SHOULD create the location', async () => {
  mocks.catalog.createLocation.mockResolvedValue(location('new'));

  await setup.execute(input);

  expect(mocks.catalog.createLocation).toHaveBeenCalledWith({
    name: 'Pantry',
    owner: 'USER',
    ownerId: 'user-id',
  });
});

it('SHOULD refuse a name already used by the owner (case-insensitive) with 409', async () => {
  mocks.catalog.findLocations.mockResolvedValue([location('x', { name: 'PANTRY' })]);

  await expect(setup.execute(input)).rejects.toThrow(ConflictException);
});

it('SHOULD answer 404 for a foreign owner', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(NotFoundException);
});
