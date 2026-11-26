import { NotFoundException } from '@nestjs/common';

import { location, mocks, setup } from './index.mocks';

it('SHOULD return the location with its item count', async () => {
  mocks.catalog.findLocationById.mockResolvedValue(location('pantry'));
  mocks.catalog.countItemsByLocation.mockResolvedValue(new Map([['pantry', 4]]));

  const row = await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'pantry' });

  expect(row.itemCount).toBe(4);
  expect(row.location.id).toBe('pantry');
});

it('SHOULD answer 404 WHEN the location is missing or belongs to an owner the user cannot read', async () => {
  mocks.catalog.findLocationById.mockResolvedValueOnce(undefined);
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'gone' }),
  ).rejects.toThrow(NotFoundException);

  mocks.catalog.findLocationById.mockResolvedValueOnce(location('pantry'));
  await expect(setup.execute({ accessibleOwners: [], id: 'pantry' })).rejects.toThrow(
    NotFoundException,
  );
});

it('SHOULD count the sub-locations and return the path (spec 125 FR 16, 18)', async () => {
  mocks.catalog.findLocationById.mockResolvedValue(location('kitchen', { name: 'Kitchen' }));
  mocks.catalog.findLocations.mockResolvedValue([
    location('kitchen', { name: 'Kitchen' }),
    location('fridge', { name: 'Fridge', parentId: 'kitchen' }),
  ]);
  mocks.catalog.countItemsByLocation.mockResolvedValue(
    new Map([
      ['fridge', 2],
      ['kitchen', 1],
    ]),
  );

  const parent = await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'kitchen' });

  expect(parent).toMatchObject({ itemCount: 3, path: 'Kitchen' });

  mocks.catalog.findLocationById.mockResolvedValue(
    location('fridge', { name: 'Fridge', parentId: 'kitchen' }),
  );

  expect(
    (await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'fridge' })).path,
  ).toBe('Kitchen / Fridge');
});
