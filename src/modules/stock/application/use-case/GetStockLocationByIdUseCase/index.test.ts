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
