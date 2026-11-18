import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { archivedOwners, category, location } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  id: 'item',
  owner: OwnerType.FAMILY,
  ownerId: 'family-id',
};

it('SHOULD report what happens to the category and the location', async () => {
  mocks.catalog.findCatalogByOwners.mockImplementation(async (owners) =>
    owners[0].owner === 'USER'
      ? {
          categories: [category('c', { name: 'Dairy' })],
          locations: [location('l', { name: 'Fridge' })],
        }
      : {
          categories: [
            category('t', { name: 'dairy', owner: OwnerType.FAMILY, ownerId: 'family-id' }),
          ],
          locations: [
            location('l2', { name: 'Fridge', owner: OwnerType.FAMILY, ownerId: 'family-id' }),
          ],
        },
  );

  expect(await setup.execute(input)).toEqual({
    category: { from: 'Dairy', to: 'dairy' },
    location: { from: 'Fridge', to: 'Fridge' },
  });
});

it('SHOULD answer 404 for an item the caller cannot see and 403 for a destination it cannot access', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(ForbiddenException);

  mocks.stock.findById.mockResolvedValue(undefined);
  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);
});

it('SHOULD refuse WHEN the destination family is archived (422)', async () => {
  await expect(setup.execute({ ...input, accessibleOwners: archivedOwners })).rejects.toThrow(
    UnprocessableEntityException,
  );
});
